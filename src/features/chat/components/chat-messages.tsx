import type { UIMessage } from 'ai'
import { cn } from '@/lib/utils'
import { Streamdown } from 'streamdown'

interface ChatMessagesProps {
  messages: UIMessage[]
  isLoading?: boolean
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  if (messages.length === 0) {
    return null
  }

  const lastMessage = messages[messages.length - 1]
  const isStreaming = isLoading && lastMessage?.role === 'assistant'

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      {messages.map((message) => {
        const text = getMessageText(message)
        const isUser = message.role === 'user'
        const isLastAssistant = message.id === lastMessage?.id && !isUser
        
        return (
          <div
            key={message.id}
            className={cn(
              'flex flex-col gap-1.5',
              isUser ? 'items-end' : 'items-start'
            )}
          >
            <div
              className={cn(
                'rounded-md text-sm leading-relaxed',
                isUser
                  ? 'bg-secondary px-3 py-2 text-foreground border border-secondary max-w-[85%]'
                  : 'text-foreground w-full'
              )}
            >
              {isUser ? (
                <p className="whitespace-pre-wrap">{text}</p>
              ) : (
                <div className={cn(
                  'prose prose-sm prose-invert max-w-none',
                  // Smooth text appearance for streaming
                  isLastAssistant && isStreaming && '**:animate-in **:fade-in **:duration-150'
                )}>
                  <Streamdown>{text}</Streamdown>
                </div>
              )}
            </div>
          </div>
        )
      })}
      {isLoading && lastMessage?.role === 'user' && (
        <div className="flex flex-col gap-1.5 items-start">
          <div className="text-sm">
            <span className="text-foreground animate-pulse">●●●</span>
          </div>
        </div>
      )}
    </div>
  )
}
