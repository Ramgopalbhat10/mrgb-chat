import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { UIMessage } from 'ai'
import { ChatSkeleton, ChatView } from '@/features/chat/components'
import { useAppStore } from '@/stores/app-store'
import { conversationKeys, messagesQueryOptions } from '@/features/chat/data/queries'
import { hydrateMessagesCache } from '@/features/chat/data/persistence'
import { useGenerateTitle } from '@/features/chat/data/mutations'

export const Route = createFileRoute('/chat/$id')({
  component: ChatPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      messageId: typeof search.messageId === 'string' ? search.messageId : undefined,
    } as { messageId?: string }
  },
})

/**
 * /chat/$id route - Handles both new and existing conversations
 * - New chats: receives pending message from /new, sends to AI, persists, generates title
 * - Existing chats: loads messages from cache and syncs from server
 */
function ChatPage() {
  const { id } = Route.useParams()
  const { messageId: scrollToMessageId } = Route.useSearch()
  const setActiveConversationId = useAppStore(
    (state) => state.setActiveConversationId,
  )
  const pendingNewChat = useAppStore((state) => state.pendingNewChat)
  const consumePendingNewChat = useAppStore((state) => state.consumePendingNewChat)
  const generateTitle = useGenerateTitle()
  const queryClient = useQueryClient()

  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [pendingSearchEnabled, setPendingSearchEnabled] = useState(false)
  const hasConsumedPending = useRef(false)

  useEffect(() => {
    setPendingMessage(null)
    setPendingSearchEnabled(false)
    hasConsumedPending.current = false
  }, [id])

  useEffect(() => {
    setActiveConversationId(id)

    // Subscribe to pendingNewChat so this effect is reactive when the store
    // is populated by /new just before navigation.  Use a ref to guard
    // against StrictMode double-invocation and page-refresh re-runs
    // (store resets to null on refresh so the guard below is sufficient).
    if (!hasConsumedPending.current && pendingNewChat?.conversationId === id) {
      hasConsumedPending.current = true
      // Capture values before clearing the store
      const { initialMessage, searchEnabled } = pendingNewChat
      consumePendingNewChat()
      generateTitle.mutate({ conversationId: id, userMessage: initialMessage })
      setPendingMessage(initialMessage)
      setPendingSearchEnabled(searchEnabled ?? false)
    }
  }, [generateTitle, id, pendingNewChat, consumePendingNewChat, setActiveConversationId])

  useEffect(() => {
    hydrateMessagesCache(queryClient, id).catch((error) => {
      console.warn('Failed to hydrate messages from IndexedDB:', error)
    })
  }, [id, queryClient])

  useEffect(() => {
    queryClient.removeQueries({
      predicate: (query) => {
        const key = query.queryKey
        return (
          Array.isArray(key) &&
          key[0] === conversationKeys.all[0] &&
          key[2] === 'messages' &&
          key[1] !== id
        )
      },
    })
  }, [id, queryClient])

  const { data: messages = [], isLoading } = useQuery(
    messagesQueryOptions(id),
  )

  const initialMessages = useMemo<Array<UIMessage>>(() => {
    return messages.map((msg) => {
      let metadata: any = undefined
      let reasoningParts: Array<{ type: 'reasoning'; text: string; state: 'done' }> = []
      let webSearchParts: Array<any> = []

      if (msg.metaJson) {
        try {
          const parsed = JSON.parse(msg.metaJson)
          if (parsed.usage) {
            metadata = {
              usage: parsed.usage,
              model: parsed.modelId,
              gatewayCost: parsed.gatewayCost,
            }
          }
          if (parsed.reasoningParts && Array.isArray(parsed.reasoningParts)) {
            reasoningParts = parsed.reasoningParts
          }
          if (parsed.webSearchParts && Array.isArray(parsed.webSearchParts)) {
            webSearchParts = parsed.webSearchParts.map((part: any, i: number) => ({
              ...part,
              toolCallId: part.toolCallId || `web-search-${msg.id}-${i}`,
            }))
          }
        } catch (e) {
          console.warn('Failed to parse metaJson:', e)
        }
      }

      const parts: UIMessage['parts'] = [
        ...reasoningParts,
        ...webSearchParts,
        { type: 'text' as const, text: msg.content },
      ] as UIMessage['parts']

      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        parts,
        createdAt: msg.createdAt,
        metadata,
      }
    })
  }, [messages])

  const isReady = !isLoading || pendingMessage !== null || initialMessages.length > 0

  if (!isReady) {
    return <ChatSkeleton />
  }

  return (
    <ChatView
      key={id}
      conversationId={id}
      initialMessages={initialMessages}
      pendingMessage={pendingMessage}
      pendingSearchEnabled={pendingSearchEnabled}
      scrollToMessageId={scrollToMessageId}
    />
  )
}
