import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { ChatHeader } from './chat-header'
import { ChatEmptyState } from './chat-empty-state'
import { useAppStore } from '@/stores/app-store'
import { useSidebar } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { SidebarLeftIcon } from '@hugeicons/core-free-icons'
import * as db from '@/lib/indexeddb'
import type { UIMessage } from 'ai'

interface ChatViewProps {
  conversationId: string
  onFirstMessage?: (userMessage: string) => void
  isNewChat?: boolean
  initialMessages?: UIMessage[]
}

export function ChatView({ conversationId, onFirstMessage, isNewChat = false, initialMessages = [] }: ChatViewProps) {
  const [input, setInput] = useState('')
  const hasCalledOnFirstMessage = useRef(false)
  const firstUserMessageRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const persistedMessageIds = useRef<Set<string>>(new Set())

  const conversations = useAppStore((state) => state.conversations)
  const titleLoadingIds = useAppStore((state) => state.titleLoadingIds)
  
  const conversation = conversations.find((c) => c.id === conversationId)
  const title = conversation?.title
  const titleIsLoading = titleLoadingIds.has(conversationId)

  // Memoize transport to prevent re-creation on each render
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), [])

  // Extract text content from UIMessage parts
  const getMessageContent = useCallback((message: UIMessage): string => {
    if (!message.parts) return ''
    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map(part => part.text)
      .join('')
  }, [])

  // Persist a single message to IndexedDB
  const persistMessage = useCallback(async (message: UIMessage) => {
    // Skip if already persisted
    if (persistedMessageIds.current.has(message.id)) return
    
    const content = getMessageContent(message)
    // Skip empty messages (streaming in progress)
    if (!content) return
    
    try {
      persistedMessageIds.current.add(message.id)
      await db.createMessage({
        id: message.id,
        conversationId,
        role: message.role as 'user' | 'assistant' | 'system' | 'tool',
        content,
        clientId: null,
        metaJson: null,
        createdAt: new Date(),
      })
    } catch (error) {
      console.error('Failed to persist message:', error)
      persistedMessageIds.current.delete(message.id)
    }
  }, [conversationId, getMessageContent])

  const { messages, sendMessage, status, setMessages } = useChat({
    id: conversationId,
    transport,
    onFinish: async ({ message }) => {
      // Persist assistant message when streaming completes
      await persistMessage(message)
    },
  })

  // Persist user messages when they appear in the messages array
  // This ensures we use the correct ID that useChat assigns
  useEffect(() => {
    const userMessages = messages.filter(m => m.role === 'user')
    userMessages.forEach(msg => {
      persistMessage(msg)
    })
  }, [messages, persistMessage])

  // Mark initial messages as already persisted
  useEffect(() => {
    initialMessages.forEach(msg => {
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

  const isLoading = status === 'streaming' || status === 'submitted'
  const hasMessages = messages.length > 0

  useEffect(() => {
    if (messages.length > 0 && !hasCalledOnFirstMessage.current && firstUserMessageRef.current) {
      hasCalledOnFirstMessage.current = true
      // Defer to next tick to avoid interfering with streaming startup
      // Store updates from onFirstMessage can cause re-renders that disrupt initial streaming
      setTimeout(() => {
        onFirstMessage?.(firstUserMessageRef.current!)
      }, 0)
    }
  }, [messages.length, onFirstMessage])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    
    const userText = input.trim()
    
    // Store the first user message for title generation
    if (!firstUserMessageRef.current) {
      firstUserMessageRef.current = userText
    }
    
    // Send message - useChat will add it to messages array with its own ID
    // The useEffect above will persist it with the correct ID
    sendMessage({ text: userText })
    setInput('')
  }

  // Determine if we should show the header
  // Don't show on new chat until there are messages
  const showHeader = !isNewChat || hasMessages
  
  // Get sidebar state for toggle button on empty new chat
  const { state: sidebarState, toggleSidebar } = useSidebar()
  const isSidebarClosed = sidebarState === 'collapsed'

  return (
    <div className="flex flex-col h-full bg-background relative">
      {showHeader ? (
        <ChatHeader 
          title={title} 
          isLoading={titleIsLoading} 
        />
      ) : (
        // Sidebar toggle - absolutely positioned to avoid layout shift
        // Uses CSS transition delay to wait for sidebar close animation
        <div 
          className={`absolute top-3 left-4 z-10 transition-opacity duration-150 ${
            isSidebarClosed ? 'opacity-100 delay-200' : 'opacity-0 pointer-events-none delay-0'
          }`}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 text-muted-foreground hover:text-foreground border-0"
          >
            <HugeiconsIcon icon={SidebarLeftIcon} size={16} />
          </Button>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <ChatEmptyState />
        ) : (
          <ChatMessages messages={messages} isLoading={isLoading} />
        )}
      </div>
      <ChatInput
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  )
}
