import { ChatView } from "@/features/chat/components"
import { createFileRoute } from "@tanstack/react-router"
import { useAppStore } from "@/stores/app-store"
import { useCallback, useState } from "react"

export const Route = createFileRoute("/new")({ component: NewChatPage })

function NewChatPage() {
  const addConversation = useAppStore((state) => state.addConversation)
  const setActiveConversationId = useAppStore((state) => state.setActiveConversationId)
  const generateTitle = useAppStore((state) => state.generateTitle)

  // Generate conversation ID once per component mount
  const [conversationId] = useState(() => crypto.randomUUID())
  
  // Track if first message has been sent
  const [hasStarted, setHasStarted] = useState(false)

  const handleFirstMessage = useCallback((userMessage: string) => {
    // Create the conversation in the store with temporary title
    addConversation({
      id: conversationId,
      title: 'New conversation',
      starred: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: new Date(),
    })
    
    // Generate title in background (non-blocking)
    generateTitle(conversationId, userMessage)
    
    // Set as active
    setActiveConversationId(conversationId)
    
    // Update URL immediately without triggering router navigation
    // replaceState doesn't trigger popstate, so TanStack Router won't react
    window.history.replaceState(null, '', `/chat/${conversationId}`)
    
    // Mark as started to show header
    setHasStarted(true)
  }, [conversationId, addConversation, generateTitle, setActiveConversationId])

  return (
    <ChatView 
      conversationId={conversationId} 
      onFirstMessage={handleFirstMessage}
      isNewChat={!hasStarted}
    />
  )
}
