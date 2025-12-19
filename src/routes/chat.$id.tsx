import { ChatView, ChatSkeleton } from "@/features/chat/components"
import { createFileRoute } from "@tanstack/react-router"
import { useAppStore } from "@/stores/app-store"
import { useEffect, useState } from "react"
import * as db from "@/lib/indexeddb"
import type { UIMessage } from "ai"

export const Route = createFileRoute("/chat/$id")({ component: ChatPage })

function ChatPage() {
  const { id } = Route.useParams()
  const setActiveConversationId = useAppStore((state) => state.setActiveConversationId)
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([])
  const [isReady, setIsReady] = useState(false)
  const [currentId, setCurrentId] = useState(id)

  // Reset state synchronously when id changes (before render completes)
  // This ensures skeleton shows immediately on navigation
  if (id !== currentId) {
    setCurrentId(id)
    setIsReady(false)
    setInitialMessages([])
  }

  // Set active conversation and load messages when route changes
  useEffect(() => {
    setActiveConversationId(id)
    
    // Load messages from IndexedDB
    const loadMessages = async () => {
      try {
        const dbMessages = await db.getMessagesByConversation(id)
        // Convert DB messages to UIMessage format
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
  }, [id, setActiveConversationId])

  // Show skeleton while loading - fading effect built into skeleton
  if (!isReady) {
    return <ChatSkeleton />
  }

  return (
    <ChatView 
      key={id} // Force remount when conversation changes to reset useChat state
      conversationId={id}
      initialMessages={initialMessages}
    />
  )
}
