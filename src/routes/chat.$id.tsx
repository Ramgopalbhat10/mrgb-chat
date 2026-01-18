import { ChatView, ChatSkeleton } from '@/features/chat/components'
import { createFileRoute } from '@tanstack/react-router'
import { useAppStore } from '@/stores/app-store'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { messagesQueryOptions } from '@/features/chat/data/queries'
import { hydrateMessagesCache } from '@/features/chat/data/persistence'
import { useGenerateTitle } from '@/features/chat/data/mutations'
import type { UIMessage } from 'ai'

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
  const consumePendingNewChat = useAppStore(
    (state) => state.consumePendingNewChat,
  )
  const generateTitle = useGenerateTitle()
  const queryClient = useQueryClient()

  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const hasConsumedPending = useRef(false)

  useEffect(() => {
    setPendingMessage(null)
    hasConsumedPending.current = false
  }, [id])

  useEffect(() => {
    setActiveConversationId(id)

    if (!hasConsumedPending.current) {
      const pending = consumePendingNewChat()
      if (pending && pending.conversationId === id) {
        hasConsumedPending.current = true
        generateTitle.mutate({
          conversationId: id,
          userMessage: pending.initialMessage,
        })
        setPendingMessage(pending.initialMessage)
      }
    }
  }, [consumePendingNewChat, generateTitle, id, setActiveConversationId])

  useEffect(() => {
    hydrateMessagesCache(queryClient, id).catch((error) => {
      console.warn('Failed to hydrate messages from IndexedDB:', error)
    })
  }, [id, queryClient])

  const { data: messages = [], isLoading } = useQuery(
    messagesQueryOptions(id),
  )

  const initialMessages = useMemo<UIMessage[]>(() => {
    return messages.map((msg) => {
      let metadata: any = undefined
      let reasoningParts: Array<{ type: 'reasoning'; text: string; state: 'done' }> = []

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
        } catch (e) {
          console.warn('Failed to parse metaJson:', e)
        }
      }

      const parts: UIMessage['parts'] = [
        ...reasoningParts,
        { type: 'text' as const, text: msg.content },
      ]

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
      scrollToMessageId={scrollToMessageId}
    />
  )
}
