import { ChatView, ChatSkeleton } from '@/features/chat/components'
import { createFileRoute } from '@tanstack/react-router'
import { useAppStore } from '@/stores/app-store'
import { useEffect, useState, useRef } from 'react'
import * as db from '@/lib/indexeddb'
import type { UIMessage } from 'ai'

export const Route = createFileRoute('/chat/$id')({ component: ChatPage })

/**
 * /chat/$id route - Handles both new and existing conversations
 * - New chats: receives pending message from /new, sends to AI, persists, generates title
 * - Existing chats: loads messages from DB
 */
function ChatPage() {
  const { id } = Route.useParams()
  const setActiveConversationId = useAppStore(
    (state) => state.setActiveConversationId,
  )
  const consumePendingNewChat = useAppStore(
    (state) => state.consumePendingNewChat,
  )
  const generateTitle = useAppStore((state) => state.generateTitle)

  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([])
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [currentId, setCurrentId] = useState(id)
  const hasConsumedPending = useRef(false)

  // Reset state synchronously when id changes
  if (id !== currentId) {
    setCurrentId(id)
    setIsReady(false)
    setInitialMessages([])
    setPendingMessage(null)
    hasConsumedPending.current = false
  }

  // Set active conversation and check for pending message or load from DB
  useEffect(() => {
    setActiveConversationId(id)

    // Check if there's a pending new chat message for this conversation
    if (!hasConsumedPending.current) {
      const pending = consumePendingNewChat()
      if (pending && pending.conversationId === id) {
        hasConsumedPending.current = true
        // Generate title in background
        generateTitle(id, pending.initialMessage)
        // Pass pending message to ChatView
        setPendingMessage(pending.initialMessage)
        setIsReady(true)
        return
      }
    }

    // For existing chats, load messages from IndexedDB
    const loadMessages = async () => {
      try {
        const dbMessages = await db.getMessagesByConversation(id)
        const uiMessages: UIMessage[] = dbMessages.map((msg) => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          parts: [{ type: 'text' as const, text: msg.content }],
          createdAt: msg.createdAt,
        }))
        setInitialMessages(uiMessages)
      } catch (error) {
        console.error('Failed to load messages:', error)
        setInitialMessages([])
      } finally {
        setIsReady(true)
      }
    }

    loadMessages()
  }, [id, setActiveConversationId, consumePendingNewChat, generateTitle])

  if (!isReady) {
    return <ChatSkeleton />
  }

  return (
    <ChatView
      key={id}
      conversationId={id}
      initialMessages={initialMessages}
      pendingMessage={pendingMessage}
    />
  )
}
