import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAppStore } from '@/stores/app-store'
import { useCallback, useState, useRef } from 'react'
import { ChatEmptyState } from '@/features/chat/components/chat-empty-state'
import { ChatInput } from '@/features/chat/components/chat-input'
import { useSidebar } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { SidebarLeftIcon } from '@hugeicons/core-free-icons'

export const Route = createFileRoute('/new')({ component: NewChatPage })

/**
 * /new route - Shows empty chat UI with input
 * On first message: creates conversation, stores pending message, navigates to /chat/$id
 * The /chat/$id route handles sending to AI, persisting, and rendering response
 */
function NewChatPage() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasSubmitted = useRef(false)

  const addConversation = useAppStore((state) => state.addConversation)
  const setActiveConversationId = useAppStore(
    (state) => state.setActiveConversationId,
  )
  const setPendingNewChat = useAppStore((state) => state.setPendingNewChat)

  // Sidebar toggle for mobile or when sidebar is collapsed
  const { state: sidebarState, toggleSidebar, isMobile, openMobile } = useSidebar()
  const showToggle = isMobile ? !openMobile : sidebarState === 'collapsed'

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim() || isSubmitting || hasSubmitted.current) return

      hasSubmitted.current = true
      setIsSubmitting(true)

      const userText = input.trim()
      const conversationId = crypto.randomUUID()

      try {
        // 1. Create conversation in store + DB
        await addConversation({
          id: conversationId,
          title: 'New conversation',
          starred: false,
          archived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastMessageAt: new Date(),
        })

        // 2. Store pending message in global state for /chat/$id to pick up
        setPendingNewChat({ conversationId, initialMessage: userText })

        // 3. Set as active and navigate - /chat/$id will handle the rest
        setActiveConversationId(conversationId)
        navigate({ to: '/chat/$id', params: { id: conversationId }, replace: true })
      } catch (error) {
        console.error('Failed to create conversation:', error)
        hasSubmitted.current = false
        setIsSubmitting(false)
      }
    },
    [input, isSubmitting, addConversation, setActiveConversationId, setPendingNewChat, navigate],
  )

  return (
    <div className="flex h-full flex-col relative">
      {/* Sidebar toggle when sidebar is collapsed or on mobile */}
      <div
        className={`absolute top-3 left-4 z-10 transition-opacity duration-150 ${
          showToggle
            ? 'opacity-100 delay-200'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8"
        >
          <HugeiconsIcon icon={SidebarLeftIcon} size={18} />
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <ChatEmptyState />
      </div>
      <ChatInput
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
      />
    </div>
  )
}
