import { ChatView, ChatSkeleton } from '@/features/chat/components'
import { createFileRoute } from '@tanstack/react-router'
import { useAppStore } from '@/stores/app-store'
import { useEffect, useState, useRef } from 'react'
import * as db from '@/lib/indexeddb'
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
 * - Existing chats: loads messages from DB
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

    // For existing chats, load messages from IndexedDB first, then sync from server if empty
    const loadMessages = async () => {
      try {
        // Step 1: Try IndexedDB first (instant)
        let dbMessages = await db.getMessagesByConversation(id)
        
        // Step 2: If IndexedDB is empty, fetch from server and sync
        if (dbMessages.length === 0) {
          try {
            const response = await fetch(`/api/conversations/${id}/messages`)
            if (response.ok) {
              const data = await response.json()
              const serverMessages = Array.isArray(data) ? data : data.messages || []
              
              // Sync server messages to IndexedDB
              for (const msg of serverMessages) {
                const message = {
                  id: msg.id,
                  conversationId: id,
                  role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
                  content: msg.content,
                  clientId: msg.clientId || null,
                  metaJson: msg.metaJson || null,
                  createdAt: new Date(msg.createdAt),
                }
                await db.createMessage(message)
              }
              
              // Reload from IndexedDB after sync
              dbMessages = await db.getMessagesByConversation(id)
            }
          } catch (serverError) {
            console.warn('Failed to fetch messages from server:', serverError)
          }
        }
        
        const uiMessages: UIMessage[] = dbMessages.map((msg) => {
          // Parse metaJson to restore usage metadata
          let metadata: any = undefined
          if (msg.metaJson) {
            try {
              const parsed = JSON.parse(msg.metaJson)
              if (parsed.usage) {
                metadata = { 
                  usage: parsed.usage, 
                  model: parsed.modelId, // Use 'model' to match API response format
                  gatewayCost: parsed.gatewayCost, // gatewayCost is stored at root level
                }
              }
            } catch (e) {
              console.warn('Failed to parse metaJson:', e)
            }
          }
          
          return {
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            parts: [{ type: 'text' as const, text: msg.content }],
            createdAt: msg.createdAt,
            metadata,
          }
        })
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
      scrollToMessageId={scrollToMessageId}
    />
  )
}
