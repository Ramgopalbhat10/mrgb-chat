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
import { availableModelsQueryOptions, sharedItemsQueryOptions, sharedKeys } from '@/features/chat/data/queries'
import * as db from '@/lib/indexeddb'
import type { UIMessage } from 'ai'
import type { ModelMetadata } from '@/features/chat/data/queries'

interface ChatViewProps {
  conversationId: string
  initialMessages?: UIMessage[]
  pendingMessage?: string | null // Initial message from /new to send to AI
  scrollToMessageId?: string // Message ID to scroll to (from shared items navigation)
}

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
  const conversations = useAppStore((state) => state.conversations)
  const titleLoadingIds = useAppStore((state) => state.titleLoadingIds)
  const updateConversation = useAppStore((state) => state.updateConversation)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  // Track which message is being regenerated (null when not regenerating)
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null)

  const conversation = conversations.find((c) => c.id === conversationId)
  const title = conversation?.title
  const titleIsLoading = titleLoadingIds.has(conversationId)

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

  // Memoize transport to prevent re-creation on each render
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat' }),
    [],
  )

  // Model metadata - moved up to be available for persistMessage
  const { data: models = [] } = useQuery(availableModelsQueryOptions())
  const selectedModelMetadata = useMemo(
    () => models.find((m: ModelMetadata) => m.id === (conversation as any)?.modelId) || models[0],
    [models, conversation],
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
          (part): part is { type: 'text'; text: string } => part.type === 'text',
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
      const usageAnnotation = msg.annotations.find((a: any) => a.type === 'usage' || a.usage)
      if (usageAnnotation?.usage) {
        return { usage: usageAnnotation.usage, modelId: undefined, gatewayCost: undefined }
      }
    }
    
    return undefined
  }, [])

  // Persist a single message to IndexedDB and server
  const persistMessage = useCallback(
    async (message: UIMessage) => {
      // Skip if already persisted
      if (persistedMessageIds.current.has(message.id)) return

      const content = getMessageContent(message)
      // Skip empty messages (streaming in progress)
      if (!content) return

      // Extract usage metadata for assistant messages (from message.metadata set by API)
      const meta = message.role === 'assistant' ? getMessageMeta(message) : undefined
      const metaJson = meta?.usage ? JSON.stringify({ 
        usage: meta.usage, 
        modelId: meta.modelId,
        gatewayCost: meta.gatewayCost,
      }) : null

      // console.log('Persisting message:', { id: message.id, role: message.role, contentLength: content.length, meta })

      const messageData = {
        id: message.id,
        conversationId,
        role: message.role as 'user' | 'assistant' | 'system' | 'tool',
        content,
        clientId: null,
        metaJson,
        createdAt: new Date(),
      }

      try {
        persistedMessageIds.current.add(message.id)

        // Persist to IndexedDB (local-first)
        await db.createMessage(messageData)

        // Persist to server (fire-and-forget, don't block on it)
        // The server endpoint handles conversation creation if missing (via onConflictDoNothing)
        fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageData),
        }).then(res => {
            if (!res.ok) console.error('Server persistence failed:', res.status, res.statusText)
        }).catch((error) => {
          console.error('Failed to persist message to server:', error)
        })
      } catch (error) {
        console.error('Failed to persist message:', error)
        persistedMessageIds.current.delete(message.id)
      }
    },
    [conversationId, getMessageContent, getMessageMeta],
  )

  const chatResult = useChat({
    id: conversationId,
    transport,
    onFinish: async ({ message }) => {
      // Persist assistant message when streaming completes
      await persistMessage(message)
    },
  })
  
  const { messages, sendMessage, status, setMessages } = chatResult as any
  
  // Share a specific message - creates a public shareable link
  const handleShareMessage = useCallback(async (messageId: string, userInput: string, response: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          conversationId,
          userInput,
          response,
          modelId: selectedModelMetadata?.id,
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
  }, [conversationId, selectedModelMetadata, queryClient])

  // Unshare a message - removes the public shareable link
  const handleUnshareMessage = useCallback(async (shareId: string): Promise<boolean> => {
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
  }, [queryClient])

  // Reload/regenerate function - updates assistant response IN PLACE (keeps same ID, just updates content)
  const handleRegenerate = useCallback(async (assistantMessageId: string) => {
    // Find the assistant message being regenerated
    const assistantIndex = messages.findIndex((m: any) => m.id === assistantMessageId)
    if (assistantIndex === -1) return
    
    // Find the user message immediately before this assistant message
    let userIndex = -1
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userIndex = i
        break
      }
    }
    if (userIndex === -1) return
    
    // 1. Set regenerating state to show loading UI
    setRegeneratingMessageId(assistantMessageId)
    
    // 2. If shared, unshare first
    const shareId = sharedMessageMap.get(assistantMessageId)
    if (shareId) {
      await handleUnshareMessage(shareId)
    }
    
    // 3. Clear content in UI immediately (keep same ID, clear metadata for fresh usage)
    setMessages((prev: any[]) => {
      const updated = [...prev]
      updated[assistantIndex] = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        parts: [{ type: 'text', text: '' }],
        metadata: undefined, // Clear old metadata/usage
      }
      return updated
    })
    
    // 3. Get messages to send to AI (everything up to and including the user message)
    const messagesForAI = messages.slice(0, userIndex + 1).map((m: any) => {
      const textContent = typeof m.content === 'string' ? m.content : 
        m.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') || ''
      return {
        id: m.id,
        role: m.role,
        content: textContent,
        parts: [{ type: 'text', text: textContent }],
      }
    })
    
    // 4. Call chat API and stream response
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesForAI }),
      })
      
      if (!response.ok || !response.body) {
        console.error('Failed to regenerate response')
        return
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''
      let messageMetadata: any = null
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (!line.trim()) continue
          // SSE format: "data: {json}" - strip the "data: " prefix
          const jsonStr = line.startsWith('data: ') ? line.slice(6) : line
          if (!jsonStr.trim() || jsonStr === '[DONE]') continue
          try {
            const parsed = JSON.parse(jsonStr)
            // Handle text-delta events from AI SDK stream
            if (parsed.type === 'text-delta' && parsed.delta) {
              fullContent += parsed.delta
              // Update message by ID
              setMessages((prev: any[]) => {
                const idx = prev.findIndex((m: any) => m.id === assistantMessageId)
                if (idx === -1) return prev
                const updated = [...prev]
                updated[idx] = {
                  ...updated[idx],
                  content: fullContent,
                  parts: [{ type: 'text', text: fullContent }],
                }
                return updated
              })
            }
            // Capture finish event with metadata (usage, model, etc.)
            if (parsed.type === 'finish' && parsed.messageMetadata) {
              messageMetadata = parsed.messageMetadata
            }
          } catch {
            // Not JSON, ignore
          }
        }
      }
      
      // Process remaining buffer
      if (buffer.trim()) {
        const jsonStr = buffer.startsWith('data: ') ? buffer.slice(6) : buffer
        if (jsonStr.trim() && jsonStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(jsonStr)
            if (parsed.type === 'text-delta' && parsed.delta) {
              fullContent += parsed.delta
            }
            if (parsed.type === 'finish' && parsed.messageMetadata) {
              messageMetadata = parsed.messageMetadata
            }
          } catch {
            // Ignore
          }
        }
      }
      
      // 5. Final update and persist (UPDATE existing record, not create new)
      if (fullContent) {
        setMessages((prev: any[]) => {
          const idx = prev.findIndex((m: any) => m.id === assistantMessageId)
          if (idx === -1) return prev
          const updated = [...prev]
          updated[idx] = {
            ...updated[idx],
            content: fullContent,
            parts: [{ type: 'text', text: fullContent }],
            // Include metadata for usage display
            metadata: messageMetadata || undefined,
          }
          return updated
        })
        
        // Update in IndexedDB (same ID)
        await db.updateMessage(assistantMessageId, { content: fullContent }).catch(console.error)
        
        // Update on server (PATCH with messageId query param)
        fetch(`/api/conversations/${conversationId}/messages?messageId=${assistantMessageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: fullContent }),
        }).catch(console.error)
      } else {
        console.error('Regeneration produced no content')
      }
    } catch (error) {
      console.error('Error regenerating response:', error)
    } finally {
      // Clear regenerating state when done (success or error)
      setRegeneratingMessageId(null)
    }
  }, [messages, setMessages, conversationId, sharedMessageMap, handleUnshareMessage])

  // User messages are persisted manually in handleSubmit for reliability
  // This ensures they're saved before any re-renders or navigation

  // Mark initial messages as already persisted
  useEffect(() => {
    initialMessages.forEach((msg) => {
      persistedMessageIds.current.add(msg.id)
    })
  }, [initialMessages])

  // Set initial messages when provided (for loading existing conversations)
  const initialMessagesSet = useRef(false)
  useEffect(() => {
    if (initialMessages.length > 0 && !initialMessagesSet.current) {
      initialMessagesSet.current = true
      setMessages(initialMessages)
    }
  }, [initialMessages, setMessages])

  // Handle pending message from /new route - send to AI and persist
  useEffect(() => {
    if (pendingMessage && !hasSentPendingMessage.current) {
      hasSentPendingMessage.current = true

      // Send message to AI
      sendMessage({ text: pendingMessage })

      // Persist user message
      const userMessageId = crypto.randomUUID()
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
  }, [pendingMessage, conversationId, sendMessage])

  const isLoading = status === 'streaming' || status === 'submitted'
  const hasMessages = messages.length > 0

  // Debug: log messages and status changes
  // useEffect(() => {
  //   console.log('useChat state:', { 
  //     status, 
  //     messageCount: messages.length,
  //     messages: messages.map((m: any) => ({ id: m.id, role: m.role, partsCount: m.parts?.length }))
  //   })
  //   console.log('useChat messages:', messages)
  // }, [messages, status])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent, modelId?: string) => {
    e.preventDefault()
    if (!input.trim()) return

    const userText = input.trim()
    setInput('')

    // Send message to AI - useChat will handle adding the message and streaming
    sendMessage({ text: userText }, { body: { modelId } })

    // Persist user message after a short delay to not interfere with useChat state
    setTimeout(async () => {
      const userMessageId = crypto.randomUUID()
      const userMessageData = {
        id: userMessageId,
        conversationId,
        role: 'user' as const,
        content: userText,
        clientId: null,
        metaJson: null,
        createdAt: new Date(),
      }

      // Update conversation with selected modelId if not already set
      if (conversation && !conversation.modelId) {
        updateConversation(conversationId, { modelId })
      }

      persistedMessageIds.current.add(userMessageId)

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
  }

  // Always show header for existing conversations
  const showHeader = true

  // Get sidebar state for toggle button (mobile or collapsed)
  const { state: sidebarState, toggleSidebar, isMobile, openMobile } = useSidebar()
  const showSidebarToggle = isMobile ? !openMobile : sidebarState === 'collapsed'

  return (
    <div className="flex flex-col h-full bg-background relative">
      {showHeader ? (
        <ChatHeader
          title={title}
          isLoading={titleIsLoading}
          conversation={conversation}
          onDeleted={handleConversationDeleted}
          showShare={true}
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
          messages={messages} 
          isLoading={isLoading || !!regeneratingMessageId}
          regeneratingMessageId={regeneratingMessageId}
          onReload={handleRegenerate}
          onShareMessage={handleShareMessage}
          onUnshareMessage={handleUnshareMessage}
          sharedMessageMap={sharedMessageMap}
          modelId={selectedModelMetadata?.id}
          scrollToMessageId={scrollToMessageId}
        />
      )}
      <ChatInput
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        messages={messages}
        defaultModelId={conversation?.modelId}
      />
    </div>
  )
}
