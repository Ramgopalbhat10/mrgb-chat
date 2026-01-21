import { useMemo } from 'react'
import type { UIMessage } from 'ai'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getMessageText } from '../messages'

interface UserMessageJumpMenuProps {
  messages: UIMessage[]
  onSelectMessage: (messageId: string) => void
}

function normalizePreview(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

export function UserMessageJumpMenu({
  messages,
  onSelectMessage,
}: UserMessageJumpMenuProps) {
  const userMessages = useMemo(() => {
    let ordinal = 0
    return messages
      .filter((message) => message.role === 'user')
      .map((message) => {
        ordinal += 1
        const preview = normalizePreview(getMessageText(message))
        return {
          id: message.id,
          ordinal,
          preview: preview || 'Untitled message',
        }
      })
  }, [messages])

  const hasUserMessages = userMessages.length > 0
  const triggerElement = (
    <Button
      variant="ghost"
      size="icon"
      disabled={!hasUserMessages}
      className="h-8 w-8 text-muted-foreground hover:text-foreground border-0 shrink-0"
      aria-label="Jump to user message"
      title="Jump to user message"
    >
      <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={2} />
    </Button>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={triggerElement} />
      <DropdownMenuContent
        side="bottom"
        align="end"
        className="w-72 max-w-[85vw] sm:w-80"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Jump to prompt</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hasUserMessages ? (
            <ScrollArea className="max-h-[60vh]">
              <div className="flex flex-col">
                {userMessages.map((message) => (
                  <DropdownMenuItem
                    key={message.id}
                    onClick={() => onSelectMessage(message.id)}
                    className="gap-2"
                    title={message.preview}
                  >
                    <span className="text-[11px] text-muted-foreground tabular-nums w-5 text-right shrink-0">
                      {message.ordinal}
                    </span>
                    <span className="truncate text-sm">{message.preview}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              No user messages yet
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
