import { useRef, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { UIMessage } from 'ai'
import { cn } from '@/lib/utils'
import { Streamdown } from 'streamdown'

interface ChatMessagesVirtualProps {
  messages: UIMessage[]
  isLoading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
}

function getMessageText(message: UIMessage): string {
  // Handle content string (user messages from useChat)
  const msg = message as any
  if (typeof msg.content === 'string' && msg.content.length > 0) {
    return msg.content
  }

  // Handle parts array (assistant messages)
  if (message.parts && message.parts.length > 0) {
    return message.parts
      .filter(
        (part): part is { type: 'text'; text: string } => part.type === 'text',
      )
      .map((part) => part.text)
      .join('')
  }

  return ''
}

// Estimate message height based on content length
function estimateMessageHeight(message: UIMessage): number {
  const text = getMessageText(message)
  const isUser = message.role === 'user'

  // Base height for padding and margins
  const baseHeight = 48

  // Estimate lines based on average characters per line
  const charsPerLine = isUser ? 60 : 80
  const lines = Math.ceil(text.length / charsPerLine)

  // Height per line (including line-height)
  const lineHeight = 24

  // For code blocks, add extra height
  const codeBlockCount = (text.match(/```/g) || []).length / 2
  const codeBlockHeight = codeBlockCount * 100

  return baseHeight + lines * lineHeight + codeBlockHeight
}

export function ChatMessagesVirtual({
  messages,
  isLoading,
  onLoadMore,
  hasMore,
}: ChatMessagesVirtualProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const lastMessageCount = useRef(messages.length)

  const lastMessage = messages[messages.length - 1]
  const isStreaming = isLoading && lastMessage?.role === 'assistant'

  // Add loading indicator as virtual item if needed
  const showLoadingIndicator = isLoading && lastMessage?.role === 'user'
  const itemCount = messages.length + (showLoadingIndicator ? 1 : 0)

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      if (index >= messages.length) {
        return 48 // Loading indicator height
      }
      return estimateMessageHeight(messages[index])
    },
    overscan: 5,
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > lastMessageCount.current) {
      lastMessageCount.current = messages.length
      virtualizer.scrollToIndex(itemCount - 1, { align: 'end', behavior: 'smooth' })
    }
  }, [messages.length, itemCount, virtualizer])

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming) {
      virtualizer.scrollToIndex(itemCount - 1, { align: 'end' })
    }
  }, [isStreaming, itemCount, virtualizer])

  // Load more when scrolling to top
  const handleScroll = useCallback(() => {
    if (!parentRef.current || !onLoadMore || !hasMore) return

    const { scrollTop } = parentRef.current
    if (scrollTop < 100) {
      onLoadMore()
    }
  }, [onLoadMore, hasMore])

  useEffect(() => {
    const element = parentRef.current
    if (!element) return

    element.addEventListener('scroll', handleScroll)
    return () => element.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  if (messages.length === 0) {
    return null
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto"
      style={{ contain: 'strict' }}
    >
      <div
        className="relative w-full max-w-3xl mx-auto"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        <div className="p-6">
          {virtualizer.getVirtualItems().map((virtualItem) => {
            // Loading indicator
            if (virtualItem.index >= messages.length) {
              return (
                <div
                  key="loading"
                  className="absolute top-0 left-0 w-full px-6"
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                    height: `${virtualItem.size}px`,
                  }}
                >
                  <div className="flex flex-col gap-1.5 items-start">
                    <div className="text-sm">
                      <span className="text-foreground animate-pulse">●●●</span>
                    </div>
                  </div>
                </div>
              )
            }

            const message = messages[virtualItem.index]
            const text = getMessageText(message)
            const isUser = message.role === 'user'
            const isLastAssistant =
              virtualItem.index === messages.length - 1 && !isUser

            return (
              <div
                key={message.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full px-6"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div
                  className={cn(
                    'flex flex-col gap-1.5 py-3',
                    isUser ? 'items-end' : 'items-start',
                  )}
                >
                  <div
                    className={cn(
                      'rounded-md text-sm leading-relaxed',
                      isUser
                        ? 'bg-secondary px-3 py-2 text-foreground border border-secondary max-w-[85%]'
                        : 'text-foreground w-full',
                    )}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{text}</p>
                    ) : (
                      <div
                        className={cn(
                          'prose prose-sm prose-invert max-w-none',
                          isLastAssistant &&
                            isStreaming &&
                            '**:animate-in **:fade-in **:duration-150',
                        )}
                      >
                        <Streamdown>{text}</Streamdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
