import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChatMessagesVirtual } from './chat-messages-virtual'
import { ChatInput } from './chat-input'
import { ChatHeader } from './chat-header'
import { ChatEmptyState } from './chat-empty-state'
import { useAppStore } from '@/stores/app-store'
import { useSidebar } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { SidebarLeftIcon } from '@hugeicons/core-free-icons'
import {
  availableModelsQueryOptions,
  conversationKeys,
  conversationsQueryOptions,
  sharedItemsQueryOptions,
  sharedKeys,
} from '@/features/chat/data/queries'
import { llmSettingsQueryOptions } from '@/features/llm-settings/data/queries'
import {
  updateConversationCache,
  updateMessagesCache,
} from '@/features/chat/data/persistence'
import * as db from '@/lib/indexeddb'
import type { Message as PersistedMessage } from '@/lib/indexeddb'
import type { UIMessage } from 'ai'
import type { ModelMetadata } from '@/features/chat/data/queries'
import type { RegenerationOptions } from '@/features/chat/types/regeneration'

interface ChatViewProps {
  conversationId: string
  initialMessages?: UIMessage[]
  pendingMessage?: string | null // Initial message from /new to send to AI
  scrollToMessageId?: string // Message ID to scroll to (from shared items navigation)
}

const DEFAULT_MODEL_ID = 'google/gemini-3-flash'

const hashString = (value: string) => {
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

const buildSuggestionSignature = (assistantId: string, assistantText: string) =>
  `${assistantId}:${hashString(assistantText)}`

const createUserMessage = (id: string, text: string): UIMessage => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text }],
})

export function ChatView({
  conversationId,
  initialMessages = [],
  pendingMessage = null,
  scrollToMessageId,
}: ChatViewProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const persistedMessageIds = useRef<Set<string>>(new Set())
  const hasSentPendingMessage = useRef(false)
  const pendingMessageIdRef = useRef<string | null>(null)
  const titleLoadingIds = useAppStore((state) => state.titleLoadingIds)
  const setPendingNewChat = useAppStore((state) => state.setPendingNewChat)
  const conversationModelOverride = useAppStore(
    (state) => state.conversationModelOverrides[conversationId],
  )
  const setConversationModelOverride = useAppStore(
    (state) => state.setConversationModelOverride,
  )
  const clearConversationModelOverride = useAppStore(
    (state) => state.clearConversationModelOverride,
  )
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: conversations = [] } = useQuery(conversationsQueryOptions())
  const { data: llmSettings } = useQuery(llmSettingsQueryOptions())
  const selectedModelIdRef = useRef<string | undefined>(undefined)
  const lastSettingsModelIdRef = useRef<string | undefined>(undefined)
  const [jumpToMessageId, setJumpToMessageId] = useState<string | null>(null)
  const jumpTargetRef = useRef<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  const [suggestionsStatus, setSuggestionsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle')
  const suggestionsAbortRef = useRef<AbortController | null>(null)
  const suggestionsSignatureRef = useRef<string | null>(null)

  // Track which message is being regenerated (null when not regenerating)
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<
    string | null
  >(null)
  const regeneratingMessageIdRef = useRef<string | null>(null)

  const conversation = conversations.find((c) => c.id === conversationId)
  const title = conversation?.title
  const titleIsLoading = titleLoadingIds.has(conversationId)
  const branchInfo = useMemo(() => {
    const isUuidLike = (value?: string | null) =>
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      )
    const isNonEmptyString = (value?: string | null) =>
      typeof value === 'string' &&
      value.trim().length > 0 &&
      value !== 'null' &&
      value !== 'undefined'
    const forkedFromId = conversation?.forkedFromConversationId
    const resolvedForkedFromId =
      isUuidLike(forkedFromId) ? forkedFromId : null
    const forkedFromMessageId = conversation?.forkedFromMessageId
    const resolvedForkedFromMessageId =
      isNonEmptyString(forkedFromMessageId) ? forkedFromMessageId : null
    if (
      !resolvedForkedFromId ||
      !resolvedForkedFromMessageId ||
      resolvedForkedFromId === conversation?.id
    ) {
      return null
    }
    const sourceConversation = conversations.find(
      (conv) => conv.id === resolvedForkedFromId,
    )
    if (!sourceConversation) return null
    return {
      id: resolvedForkedFromId,
      title: sourceConversation.title,
      anchorMessageId: resolvedForkedFromMessageId,
    }
  }, [
    conversation?.forkedFromConversationId,
    conversation?.forkedFromMessageId,
    conversation?.id,
    conversations,
  ])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.title = title ? title : 'MRGB Chat'
  }, [title])

  // Fetch shared items to show indicator on shared messages
  const { data: sharedData } = useQuery(sharedItemsQueryOptions())

  // Create a Map of originalMessageId -> shareId for quick lookup and correct URLs
  const sharedMessageMap = useMemo((): Map<string, string> => {
    if (!sharedData?.responses) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const item of sharedData.responses) {
      if (item.originalMessageId) {
        map.set(item.originalMessageId, item.id)
      }
    }
    return map
  }, [sharedData])

  const handleConversationDeleted = () => {
    navigate({ to: '/new' })
  }

  const handleModelChange = useCallback(
    (modelId: string) => {
      setConversationModelOverride(conversationId, modelId)
      selectedModelIdRef.current = modelId
    },
    [conversationId, setConversationModelOverride],
  )

  const handleJumpToMessage = useCallback((messageId: string) => {
    if (jumpTargetRef.current === messageId) {
      setJumpToMessageId(null)
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => setJumpToMessageId(messageId))
      } else {
        setTimeout(() => setJumpToMessageId(messageId), 0)
      }
      return
    }

    setJumpToMessageId(messageId)
  }, [])

  // Memoize transport to prevent re-creation on each render
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: () => ({ modelId: selectedModelIdRef.current }),
      }),
    [],
  )

  // Model metadata - moved up to be available for persistMessage
  const { data: models = [] } = useQuery(availableModelsQueryOptions())
  const selectedModelId =
    conversationModelOverride ??
    llmSettings?.modelId ??
    models[0]?.id ??
    DEFAULT_MODEL_ID
  useEffect(() => {
    if (selectedModelId) {
      selectedModelIdRef.current = selectedModelId
    }
  }, [selectedModelId])

  useEffect(() => {
    const settingsModelId = llmSettings?.modelId
    if (!settingsModelId) return
    if (
      lastSettingsModelIdRef.current &&
      lastSettingsModelIdRef.current !== settingsModelId
    ) {
      clearConversationModelOverride(conversationId)
    }
    lastSettingsModelIdRef.current = settingsModelId
  }, [clearConversationModelOverride, conversationId, llmSettings?.modelId])

  useEffect(() => {
    jumpTargetRef.current = jumpToMessageId
  }, [jumpToMessageId])

  useEffect(() => {
    setJumpToMessageId(null)
  }, [conversationId])

  useEffect(() => {
    if (scrollToMessageId) {
      setJumpToMessageId(null)
    }
  }, [scrollToMessageId])

  const selectedModelMetadata = useMemo(
    () => models.find((m: ModelMetadata) => m.id === selectedModelId) || models[0],
    [models, selectedModelId],
  )

  // Extract text content from UIMessage - handles both parts array and content string
  const getMessageContent = useCallback((message: UIMessage): string => {
    // User messages from useChat usually have 'content' string
    // casting to any to avoid type issues if UIMessage definition is strict
    const msg = message as any
    if (typeof msg.content === 'string' && msg.content.length > 0) {
      return msg.content
    }

    // Assistant messages (or others) might use parts
    if (message.parts && message.parts.length > 0) {
      return message.parts
        .filter(
          (part): part is { type: 'text'; text: string } =>
            part.type === 'text',
        )
        .map((part) => part.text)
        .join('')
    }

    // Debug log if content missing
    console.warn('getMessageContent: Empty content', message)
    return ''
  }, [])

  // Extract usage and model from message metadata (AI SDK v5 uses message.metadata)
  const getMessageMeta = useCallback((message: UIMessage) => {
    const msg = message as any

    // AI SDK v5: metadata is set via messageMetadata callback in the stream response
    if (msg.metadata) {
      return {
        usage: msg.metadata.usage,
        modelId: msg.metadata.model,
        gatewayCost: msg.metadata.gatewayCost,
      }
    }

    // Fallback: check annotations (older API versions)
    if (msg.annotations) {
      const usageAnnotation = msg.annotations.find(
        (a: any) => a.type === 'usage' || a.usage,
      )
      if (usageAnnotation?.usage) {
        return {
          usage: usageAnnotation.usage,
          modelId: undefined,
          gatewayCost: undefined,
        }
      }
    }

    return undefined
  }, [])

  const buildMetaJson = useCallback(
    (message: UIMessage) => {
      const meta =
        message.role === 'assistant' ? getMessageMeta(message) : undefined

      const reasoningParts = message.parts
        ?.filter((part) => part.type === 'reasoning')
        .map((part) => {
          const reasoningPart = part as {
            type: 'reasoning'
            text: string
            state?: 'streaming' | 'done'
          }
          return {
            type: 'reasoning' as const,
            text: reasoningPart.text,
            state: 'done' as const,
          }
        })

      return meta?.usage || (reasoningParts && reasoningParts.length > 0)
        ? JSON.stringify({
            usage: meta?.usage,
            modelId: meta?.modelId,
            gatewayCost: meta?.gatewayCost,
            reasoningParts: reasoningParts?.length ? reasoningParts : undefined,
          })
        : null
    },
    [getMessageMeta],
  )

  const areMessageMetasEqual = useCallback(
    (
      currentMeta: ReturnType<typeof getMessageMeta> | undefined,
      nextMeta: ReturnType<typeof getMessageMeta> | undefined,
    ) => {
      if (!currentMeta && !nextMeta) return true
      if (!currentMeta || !nextMeta) return false

      if ((currentMeta.modelId ?? null) !== (nextMeta.modelId ?? null)) {
        return false
      }
      if ((currentMeta.gatewayCost ?? null) !== (nextMeta.gatewayCost ?? null)) {
        return false
      }

      const currentUsage = currentMeta.usage
      const nextUsage = nextMeta.usage
      if (
        (currentUsage?.inputTokens ?? null) !==
          (nextUsage?.inputTokens ?? null) ||
        (currentUsage?.outputTokens ?? null) !==
          (nextUsage?.outputTokens ?? null) ||
        (currentUsage?.totalTokens ?? null) !==
          (nextUsage?.totalTokens ?? null) ||
        (currentUsage?.reasoningTokens ?? null) !==
          (nextUsage?.reasoningTokens ?? null) ||
        (currentUsage?.gatewayCost ?? null) !==
          (nextUsage?.gatewayCost ?? null)
      ) {
        return false
      }

      return true
    },
    [],
  )

  const mergeMessagesFromCache = useCallback(
    (current: UIMessage[], cached: UIMessage[]) => {
      if (cached.length === 0) return current
      if (current.length === 0) return cached

      const currentById = new Map(current.map((message) => [message.id, message]))
      const cachedIds = new Set(cached.map((message) => message.id))
      let changed = false

      const merged = cached.map((cachedMessage) => {
        const currentMessage = currentById.get(cachedMessage.id)
        if (!currentMessage) {
          changed = true
          return cachedMessage
        }

        const currentText = getMessageContent(currentMessage)
        const cachedText = getMessageContent(cachedMessage)
        if (currentText !== cachedText) {
          changed = true
          return cachedMessage
        }

        const currentMeta = getMessageMeta(currentMessage)
        const cachedMeta = getMessageMeta(cachedMessage)
        if (areMessageMetasEqual(currentMeta, cachedMeta)) {
          return currentMessage
        }

        if (!cachedMeta) {
          return currentMessage
        }

        changed = true
        return {
          ...currentMessage,
          metadata: {
            ...(currentMessage as any).metadata,
            ...(cachedMessage as any).metadata,
          },
        } as UIMessage
      })

      for (const currentMessage of current) {
        if (!cachedIds.has(currentMessage.id)) {
          merged.push(currentMessage)
          changed = true
        }
      }

      return changed ? merged : current
    },
    [areMessageMetasEqual, getMessageContent, getMessageMeta],
  )

  const clearSuggestions = useCallback((resetSignature = false) => {
    suggestionsAbortRef.current?.abort()
    suggestionsAbortRef.current = null
    setSuggestions(null)
    setSuggestionsStatus('idle')
    if (resetSignature) {
      suggestionsSignatureRef.current = null
    }
  }, [])

  const getSuggestionContext = useCallback(
    (messages: UIMessage[], assistantId?: string) => {
      if (messages.length === 0) return null
      if (!assistantId && messages[messages.length - 1]?.role !== 'assistant') {
        return null
      }

      let assistantIndex = -1
      if (assistantId) {
        assistantIndex = messages.findIndex(
          (message) => message.id === assistantId,
        )
      }

      if (assistantIndex === -1) {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          if (messages[i].role === 'assistant') {
            assistantIndex = i
            break
          }
        }
      }

      if (assistantIndex === -1) return null

      const assistantMessage = messages[assistantIndex]
      if (assistantMessage.role !== 'assistant') return null
      const assistantText = getMessageContent(assistantMessage).trim()
      if (!assistantText) return null

      let userMessage: UIMessage | null = null
      for (let i = assistantIndex - 1; i >= 0; i -= 1) {
        if (messages[i].role === 'user') {
          userMessage = messages[i]
          break
        }
      }

      if (!userMessage) return null

      const userText = getMessageContent(userMessage).trim()
      if (!userText) return null

      const signature = buildSuggestionSignature(
        assistantMessage.id,
        assistantText,
      )

      return {
        userMessage: userText,
        assistantMessage: assistantText,
        signature,
      }
    },
    [getMessageContent],
  )

  const requestSuggestions = useCallback(
    async (context: {
      userMessage: string
      assistantMessage: string
      signature: string
    }) => {
      suggestionsAbortRef.current?.abort()
      const controller = new AbortController()
      suggestionsAbortRef.current = controller
      suggestionsSignatureRef.current = context.signature
      setSuggestions(null)
      setSuggestionsStatus('loading')

      try {
        const response = await fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage: context.userMessage,
            assistantMessage: context.assistantMessage,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Suggestions request failed: ${response.status}`)
        }

        const data = await response.json()
        const rawSuggestions = Array.isArray(data?.suggestions)
          ? data.suggestions
          : []
        const cleaned = rawSuggestions
          .map((item: unknown) => (typeof item === 'string' ? item : ''))
          .map((item: string) =>
            item.replace(/`+/g, '').replace(/\s+/g, ' ').trim(),
          )
          .filter(Boolean)
        const unique = Array.from(new Set(cleaned))
        const nextSuggestions =
          unique.length >= 5 ? unique.slice(0, 5) : cleaned.slice(0, 5)

        if (controller.signal.aborted) return

        if (nextSuggestions.length === 0) {
          setSuggestions(null)
          setSuggestionsStatus('idle')
          return
        }

        setSuggestions(nextSuggestions)
        setSuggestionsStatus('ready')
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Failed to generate suggestions:', error)
        setSuggestions(null)
        setSuggestionsStatus('error')
      }
    },
    [],
  )

  const appendMessageToCache = useCallback(
    (messageData: PersistedMessage) => {
      updateMessagesCache(queryClient, conversationId, (current) => [
        ...current,
        messageData,
      ])
      updateConversationCache(queryClient, (current) =>
        current.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                lastMessageAt: messageData.createdAt,
                updatedAt: new Date(),
              }
            : conv,
        ),
      )
    },
    [conversationId, queryClient],
  )

  const updateMessageInCache = useCallback(
    (messageId: string, updates: Partial<PersistedMessage>) => {
      updateMessagesCache(queryClient, conversationId, (current) =>
        current.map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg,
        ),
      )
    },
    [conversationId, queryClient],
  )

  const removeMessageFromCache = useCallback(
    (messageId: string) => {
      updateMessagesCache(queryClient, conversationId, (current) =>
        current.filter((msg) => msg.id !== messageId),
      )
    },
    [conversationId, queryClient],
  )

  // Persist a single message to IndexedDB and server
  const persistMessage = useCallback(
    async (message: UIMessage) => {
      const content = getMessageContent(message)
      // Skip empty messages (streaming in progress)
      if (!content) return

      const metaJson = buildMetaJson(message)

      // console.log('Persisting message:', { id: message.id, role: message.role, contentLength: content.length, meta })

      try {
        if (persistedMessageIds.current.has(message.id)) {
          if (regeneratingMessageIdRef.current !== message.id) return

          // Update existing message during regeneration
          await db
            .updateMessage(message.id, { content, metaJson })
            .catch(console.error)
          updateMessageInCache(message.id, { content, metaJson })

          fetch(
            `/api/conversations/${conversationId}/messages?messageId=${message.id}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content, metaJson }),
            },
          ).catch(console.error)

          return
        }

        const messageData = {
          id: message.id,
          conversationId,
          role: message.role as 'user' | 'assistant' | 'system' | 'tool',
          content,
          clientId: null,
          metaJson,
          createdAt: new Date(),
        }

        persistedMessageIds.current.add(message.id)

        // Persist to IndexedDB (local-first)
        await db.createMessage(messageData)
        appendMessageToCache(messageData)

        // Persist to server (fire-and-forget, don't block on it)
        // The server endpoint handles conversation creation if missing (via onConflictDoNothing)
        fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageData),
        })
          .then((res) => {
            if (!res.ok)
              console.error(
                'Server persistence failed:',
                res.status,
                res.statusText,
              )
          })
          .catch((error) => {
            console.error('Failed to persist message to server:', error)
          })
      } catch (error) {
        console.error('Failed to persist message:', error)
        persistedMessageIds.current.delete(message.id)
      }
    },
    [
      appendMessageToCache,
      buildMetaJson,
      conversationId,
      getMessageContent,
      updateMessageInCache,
    ],
  )

  const compactMessageParts = useCallback((message: UIMessage) => {
    if (!message.parts || message.parts.length === 0) return message

    const nextParts: UIMessage['parts'] = []
    let textBuffer = ''

    for (const part of message.parts) {
      if (part.type === 'text') {
        textBuffer += (part as { type: 'text'; text: string }).text ?? ''
        continue
      }
      if (textBuffer) {
        nextParts.push({ type: 'text', text: textBuffer })
        textBuffer = ''
      }
      nextParts.push(part)
    }

    if (textBuffer) {
      nextParts.push({ type: 'text', text: textBuffer })
    }

    if (
      nextParts.length === message.parts.length &&
      nextParts.every((part, index) => part === message.parts?.[index])
    ) {
      return message
    }

    return {
      ...message,
      parts: nextParts,
      ...(message.role === 'assistant' ? { content: undefined } : {}),
    } as UIMessage
  }, [])

  const chatResult = useChat({
    id: conversationId,
    transport,
    experimental_throttle: 50,
    onFinish: async ({ message, messages, isAbort, isError }) => {
      // Persist assistant message when streaming completes
      await persistMessage(message)
      setMessages((current: UIMessage[]) =>
        current.map((msg) =>
          msg.id === message.id ? compactMessageParts(msg) : msg,
        ),
      )

      if (isAbort || isError || message.role !== 'assistant') return

      const context = getSuggestionContext(messages, message.id)
      if (!context) return
      if (suggestionsSignatureRef.current === context.signature) return

      requestSuggestions(context)
    },
  })

  const {
    messages: chatMessages,
    sendMessage,
    status,
    setMessages,
    regenerate,
  } = chatResult as any

  useEffect(() => {
    const pendingId = pendingMessageIdRef.current
    if (!pendingId) return
    const hasPending = chatMessages.some(
      (message: UIMessage) => message.id === pendingId && message.role === 'user',
    )
    if (!hasPending) return
    pendingMessageIdRef.current = null
    setPendingNewChat(null)
  }, [chatMessages, setPendingNewChat])

  useEffect(() => {
    return () => {
      suggestionsAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    clearSuggestions(true)
  }, [conversationId, clearSuggestions])

  useEffect(() => {
    if (status === 'streaming' || status === 'submitted') {
      clearSuggestions()
    }
  }, [clearSuggestions, status])

  useEffect(() => {
    if (status !== 'ready') return
    if (suggestionsStatus === 'loading') return
    const context = getSuggestionContext(chatMessages)
    if (!context) return
    if (suggestionsSignatureRef.current === context.signature) return
    requestSuggestions(context)
  }, [
    chatMessages,
    getSuggestionContext,
    requestSuggestions,
    status,
    suggestionsStatus,
  ])

  useEffect(() => {
    return () => {
      setMessages([])
    }
  }, [setMessages])

  // Share a specific message - creates a public shareable link
  const handleShareMessage = useCallback(
    async (
      messageId: string,
      userInput: string,
      response: string,
    ): Promise<string | null> => {
      try {
        const res = await fetch('/api/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            conversationId,
            userInput,
            response,
            modelId:
              selectedModelIdRef.current ??
              selectedModelId ??
              selectedModelMetadata?.id,
          }),
        })

        if (!res.ok) {
          console.error('Failed to create share link')
          return null
        }

        const data = await res.json()
        // Refetch shared items to update the map
        queryClient.invalidateQueries({ queryKey: sharedKeys.items() })
        return data.url
      } catch (error) {
        console.error('Error sharing message:', error)
        return null
      }
    },
    [conversationId, selectedModelId, selectedModelMetadata, queryClient],
  )

  // Unshare a message - removes the public shareable link
  const handleUnshareMessage = useCallback(
    async (shareId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/share?id=${shareId}`, {
          method: 'DELETE',
        })

        if (!res.ok) {
          console.error('Failed to delete share link')
          return false
        }

        // Refetch shared items to update the map
        queryClient.invalidateQueries({ queryKey: sharedKeys.items() })
        return true
      } catch (error) {
        console.error('Error unsharing message:', error)
        return false
      }
    },
    [queryClient],
  )

  // Reload/regenerate function - uses AI SDK regenerate for in-place updates
  const handleRegenerate = useCallback(
    async (assistantMessageId: string, options?: RegenerationOptions) => {
      clearSuggestions()
      // Find the assistant message being regenerated
      const assistantIndex = chatMessages.findIndex(
        (m: any) => m.id === assistantMessageId,
      )
      if (assistantIndex === -1) return

      const tailMessages: UIMessage[] = chatMessages.slice(assistantIndex + 1)
      if (tailMessages.length > 0) {
        setMessages((current: UIMessage[]) => {
          const index = current.findIndex((m) => m.id === assistantMessageId)
          if (index === -1) return current
          return current.slice(0, index + 1)
        })

        for (const message of tailMessages) {
          persistedMessageIds.current.delete(message.id)
        }

        void (async () => {
          await Promise.allSettled(
            tailMessages.map((message) =>
              db.deleteMessage(message.id).catch((error) => {
                console.error('Failed to delete message from IndexedDB:', error)
              }),
            ),
          )

          tailMessages.forEach((message) => {
            removeMessageFromCache(message.id)
          })

          await Promise.allSettled(
            tailMessages.map((message) =>
              fetch(
                `/api/conversations/${conversationId}/messages?messageId=${message.id}`,
                {
                  method: 'DELETE',
                },
              ).catch((error) => {
                console.error('Failed to delete message from server:', error)
              }),
            ),
          )

          queryClient.invalidateQueries({ queryKey: sharedKeys.items() })
        })()
      }

      if (tailMessages.length > 0) {
        await new Promise<void>((resolve) => {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          } else {
            setTimeout(resolve, 0)
          }
        })
      }

      // 1. Set regenerating state to show loading UI
      setRegeneratingMessageId(assistantMessageId)
      regeneratingMessageIdRef.current = assistantMessageId

      // 2. If shared, unshare first
      const shareId = sharedMessageMap.get(assistantMessageId)
      if (shareId) {
        await handleUnshareMessage(shareId)
      }

      const resolvedModelId =
        options?.modelId ?? selectedModelIdRef.current ?? selectedModelId
      const trimmedInstruction = options?.instruction?.trim()
      const shouldSendRegeneration =
        options?.mode === 'expand' ||
        options?.mode === 'concise' ||
        options?.mode === 'instruction' ||
        !!trimmedInstruction
      const regeneration = shouldSendRegeneration
        ? {
            mode: options?.mode,
            instruction: trimmedInstruction,
            assistantText: options?.assistantText,
          }
        : undefined
      try {
        await regenerate({
          messageId: assistantMessageId,
          body: {
            modelId: resolvedModelId,
            regeneration,
          },
        })
      } catch (error) {
        console.error('Error regenerating response:', error)
      } finally {
        // Clear regenerating state when done (success or error)
        setRegeneratingMessageId(null)
        regeneratingMessageIdRef.current = null
      }
    },
    [
      chatMessages,
      clearSuggestions,
      selectedModelId,
      regenerate,
      removeMessageFromCache,
      setMessages,
      sharedMessageMap,
      handleUnshareMessage,
      conversationId,
      queryClient,
    ],
  )

  // Edit user message and regenerate - finds the next assistant message and regenerates with new content
  const handleEditMessage = useCallback(
    async (userMessageId: string, newContent: string) => {
      clearSuggestions()
      // Find the user message being edited
      const userIndex = chatMessages.findIndex(
        (m: any) => m.id === userMessageId,
      )
      if (userIndex === -1) return

      // Update the user message content in state
      setMessages((current: UIMessage[]) => {
        const newMessages = [...current]
        const index = newMessages.findIndex((m) => m.id === userMessageId)
        if (index !== -1) {
          newMessages[index] = {
            ...newMessages[index],
            content: newContent,
            parts: [{ type: 'text', text: newContent }],
          } as any
        }
        return newMessages
      })

      // Update in IndexedDB and server
      db.updateMessage(userMessageId, { content: newContent }).catch(console.error)
      updateMessageInCache(userMessageId, { content: newContent })
      fetch(
        `/api/conversations/${conversationId}/messages?messageId=${userMessageId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newContent }),
        },
      ).catch(console.error)

      // Find the next assistant message (the one we need to regenerate)
      const assistantMessage = chatMessages[userIndex + 1]
      if (assistantMessage && assistantMessage.role === 'assistant') {
        // Regenerate the assistant response
        await handleRegenerate(assistantMessage.id)
      } else {
        // No assistant message after this user message - send to AI to get a new response
        sendMessage({ text: newContent })
      }
    },
    [
      chatMessages,
      clearSuggestions,
      conversationId,
      handleRegenerate,
      sendMessage,
      setMessages,
      updateMessageInCache,
    ],
  )

  const handleBranchFromAssistant = useCallback(
    async (assistantMessageId: string) => {
      const assistantIndex = chatMessages.findIndex(
        (message: UIMessage) => message.id === assistantMessageId,
      )
      if (assistantIndex === -1) return

      const assistantMessage = chatMessages[assistantIndex]
      if (!assistantMessage || assistantMessage.role !== 'assistant') return

      const sourceMessages = chatMessages.slice(0, assistantIndex + 1)
      if (sourceMessages.length === 0) return

      const now = new Date()
      const branchConversationId = crypto.randomUUID()
      const baseTitle = conversation?.title ?? 'New conversation'
      const branchTitle = baseTitle
      const baseTime =
        now.getTime() - Math.max(sourceMessages.length - 1, 0) * 1000

      const messageIdMap: Array<{
        sourceMessageId: string
        newMessageId: string
      }> = []

      let pivotNewMessageId: string | null = null
      const newMessages = sourceMessages.map((message: UIMessage, index: number) => {
        const newMessageId = crypto.randomUUID()
        if (message.id === assistantMessageId) {
          pivotNewMessageId = newMessageId
        }
        messageIdMap.push({
          sourceMessageId: message.id,
          newMessageId,
        })

        return {
          id: newMessageId,
          conversationId: branchConversationId,
          role: message.role as 'user' | 'assistant' | 'system' | 'tool',
          content: getMessageContent(message),
          clientId: null,
          metaJson: buildMetaJson(message),
          createdAt: new Date(baseTime + index * 1000),
        }
      })

      const lastMessageAt = newMessages[newMessages.length - 1]?.createdAt ?? now

      const newConversation = {
        id: branchConversationId,
        title: branchTitle,
        modelId: selectedModelId,
        starred: false,
        archived: false,
        isPublic: false,
        forkedFromConversationId: conversationId,
        forkedFromMessageId: pivotNewMessageId ?? assistantMessageId,
        forkedAt: now,
        createdAt: now,
        updatedAt: now,
        lastMessageAt,
      }

      try {
        updateConversationCache(queryClient, (current) => [
          newConversation,
          ...current.filter((conv) => conv.id !== branchConversationId),
        ])
        queryClient.setQueryData(
          conversationKeys.detail(branchConversationId),
          newConversation,
        )
        updateMessagesCache(queryClient, branchConversationId, () => newMessages)

        await db.createConversation(newConversation)
        for (const message of newMessages) {
          await db.createMessage(message)
        }

        navigate({ to: '/chat/$id', params: { id: branchConversationId } })

        fetch(`/api/conversations/${conversationId}/branch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assistantMessageId,
            newConversationId: branchConversationId,
            messageIdMap,
          }),
        })
          .then((res) => {
            if (!res.ok) {
              console.error(
                'Server branch failed:',
                res.status,
                res.statusText,
              )
            }
          })
          .catch((error) => {
            console.error('Failed to persist branch to server:', error)
          })
      } catch (error) {
        console.error('Failed to create branched conversation:', error)
      }
    },
    [
      buildMetaJson,
      chatMessages,
      conversation?.title,
      conversationId,
      getMessageContent,
      navigate,
      queryClient,
      selectedModelId,
      updateConversationCache,
      updateMessagesCache,
    ],
  )

  // User messages are persisted manually in handleSubmit for reliability
  // This ensures they're saved before any re-renders or navigation

  // Mark initial messages as already persisted
  useEffect(() => {
    initialMessages.forEach((msg) => {
      persistedMessageIds.current.add(msg.id)
    })
  }, [initialMessages])

  // Sync messages from cache when not streaming or regenerating
  useEffect(() => {
    if (initialMessages.length === 0) return
    if (status === 'streaming' || status === 'submitted') return
    if (regeneratingMessageId) return
    const merged = mergeMessagesFromCache(chatMessages, initialMessages)
    if (merged === chatMessages) return
    setMessages(merged)
  }, [
    chatMessages,
    initialMessages,
    mergeMessagesFromCache,
    regeneratingMessageId,
    setMessages,
    status,
  ])

  // Handle pending message from /new route - send to AI and persist
  useEffect(() => {
    if (pendingMessage && !hasSentPendingMessage.current) {
      hasSentPendingMessage.current = true

      const userMessageId = crypto.randomUUID()
      const resolvedModelId = selectedModelIdRef.current ?? selectedModelId

      // Send message to AI
      const userMessage = createUserMessage(userMessageId, pendingMessage)
      setMessages((current: UIMessage[]) => {
        if (current.some((message) => message.id === userMessageId)) {
          return current
        }
        return [...current, userMessage]
      })
      pendingMessageIdRef.current = userMessageId
      const sendPromise = sendMessage(
        { text: pendingMessage, messageId: userMessageId },
        { body: { modelId: resolvedModelId } },
      )
      sendPromise.catch((error: unknown) => {
        console.error('Failed to send pending message:', error)
        hasSentPendingMessage.current = false
        pendingMessageIdRef.current = null
      })

      // Persist user message
      const userMessageData = {
        id: userMessageId,
        conversationId,
        role: 'user' as const,
        content: pendingMessage,
        clientId: null,
        metaJson: null,
        createdAt: new Date(),
      }

      persistedMessageIds.current.add(userMessageId)
      appendMessageToCache(userMessageData)

      db.createMessage(userMessageData).catch((error) => {
        console.error('Failed to persist user message to IndexedDB:', error)
      })

      // Persist to server
      fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userMessageData),
      }).catch(console.error)
    }
  }, [
    appendMessageToCache,
    conversationId,
    pendingMessage,
    sendMessage,
    selectedModelId,
  ])

  const isLoading = status === 'streaming' || status === 'submitted'
  const hasMessages = chatMessages.length > 0
  const resolvedScrollToMessageId = jumpToMessageId ?? scrollToMessageId

  // Debug: log messages and status changes
  // useEffect(() => {
  //   console.log('useChat state:', {
  //     status,
  //     messageCount: chatMessages.length,
  //     messages: chatMessages.map((m: any) => ({ id: m.id, role: m.role, partsCount: m.parts?.length }))
  //   })
  //   console.log('useChat messages:', chatMessages)
  // }, [chatMessages, status])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages])

  const sendUserMessage = useCallback(
    (userText: string, modelId?: string) => {
      const trimmed = userText.trim()
      if (!trimmed) return

      const resolvedModelId = modelId ?? selectedModelIdRef.current
      const userMessageId = crypto.randomUUID()

      // Send message to AI - useChat will handle adding the message and streaming
      const userMessage = createUserMessage(userMessageId, trimmed)
      setMessages((current: UIMessage[]) => {
        if (current.some((message) => message.id === userMessageId)) {
          return current
        }
        return [...current, userMessage]
      })
      const sendPromise = sendMessage(
        { text: trimmed, messageId: userMessageId },
        { body: { modelId: resolvedModelId } },
      )
      sendPromise.catch((error: unknown) => {
        console.error('Failed to send message:', error)
      })

      // Persist user message after a short delay to not interfere with useChat state
      setTimeout(async () => {
        const userMessageData = {
          id: userMessageId,
          conversationId,
          role: 'user' as const,
          content: trimmed,
          clientId: null,
          metaJson: null,
          createdAt: new Date(),
        }

        persistedMessageIds.current.add(userMessageId)
        appendMessageToCache(userMessageData)

        try {
          await db.createMessage(userMessageData)
        } catch (error) {
          console.error('Failed to persist user message to IndexedDB:', error)
        }

        // Persist to server (fire-and-forget)
        fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userMessageData),
        }).catch(console.error)
      }, 100)
    },
    [appendMessageToCache, conversationId, sendMessage],
  )

  const handleSubmit = async (e: React.FormEvent, modelId?: string) => {
    e.preventDefault()
    if (!input.trim()) return

    const userText = input.trim()
    setInput('')
    clearSuggestions()
    sendUserMessage(userText, modelId)
  }

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      const trimmed = suggestion.trim()
      if (!trimmed) return
      setInput('')
      clearSuggestions()
      sendUserMessage(trimmed, selectedModelIdRef.current)
    },
    [clearSuggestions, sendUserMessage, setInput],
  )

  // Always show header for existing conversations
  const showHeader = true

  // Get sidebar state for toggle button (mobile or collapsed)
  const {
    state: sidebarState,
    toggleSidebar,
    isMobile,
    openMobile,
  } = useSidebar()
  const showSidebarToggle = isMobile
    ? !openMobile
    : sidebarState === 'collapsed'

  return (
    <div className="flex flex-col h-full bg-background relative">
      {showHeader ? (
        <ChatHeader
          title={title}
          isLoading={titleIsLoading}
          conversation={conversation}
          onDeleted={handleConversationDeleted}
          showShare={true}
          messages={chatMessages}
          onJumpToMessage={handleJumpToMessage}
        />
      ) : (
        // Sidebar toggle - absolutely positioned to avoid layout shift
        // Uses CSS transition delay to wait for sidebar close animation
        <div
          className={`absolute top-3 left-4 z-10 transition-opacity duration-150 ${
            showSidebarToggle
              ? 'opacity-100 delay-200'
              : 'opacity-0 pointer-events-none delay-0'
          }`}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 text-muted-foreground hover:text-foreground border-0"
          >
            <HugeiconsIcon icon={SidebarLeftIcon} size={16} strokeWidth={2} />
          </Button>
        </div>
      )}
      {!hasMessages ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <ChatEmptyState />
        </div>
      ) : (
        <ChatMessagesVirtual
          messages={chatMessages}
          isLoading={isLoading || !!regeneratingMessageId}
          regeneratingMessageId={regeneratingMessageId}
          suggestions={suggestions ?? undefined}
          suggestionsLoading={suggestionsStatus === 'loading'}
          onSelectSuggestion={handleSuggestionSelect}
          onReload={handleRegenerate}
          onBranchFromAssistant={handleBranchFromAssistant}
          onEditMessage={handleEditMessage}
          onShareMessage={handleShareMessage}
          onUnshareMessage={handleUnshareMessage}
          sharedMessageMap={sharedMessageMap}
          modelId={selectedModelId}
          branchInfo={branchInfo}
          scrollToMessageId={resolvedScrollToMessageId}
        />
      )}
      <ChatInput
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        messages={chatMessages}
        defaultModelId={conversation?.modelId}
        selectedModelId={selectedModelId}
        onModelChange={handleModelChange}
      />
    </div>
  )
}
