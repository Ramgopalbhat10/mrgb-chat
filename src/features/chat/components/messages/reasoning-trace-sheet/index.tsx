import { useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Streamdown } from 'streamdown'
import type { UIMessage } from 'ai'
import { cn } from '@/lib/utils'
import {
  getReasoningParts,
  getReasoningText,
} from '../utils'

interface ReasoningTraceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: UIMessage | null
}

export function ReasoningTraceSheet({
  open,
  onOpenChange,
  message,
}: ReasoningTraceSheetProps) {
  const reasoningParts = useMemo(
    () => (message ? getReasoningParts(message) : []),
    [message],
  )
  const reasoningText = useMemo(
    () => (message ? getReasoningText(message) : ''),
    [message],
  )
  const reasoningBlocks = useMemo(() => {
    const lines = reasoningText.split('\n')
    const blocks: string[] = []
    let currentBlock: string[] = []

    for (const line of lines) {
      const trimmedLine = line.trim()
      const isHeader = /^(\*\*|#{1,6}\s)/.test(trimmedLine)

      if (isHeader && currentBlock.length > 0) {
        const blockText = currentBlock.join('\n').trim()
        if (blockText) blocks.push(blockText)
        currentBlock = [line]
      } else if (trimmedLine === '' && currentBlock.length > 0) {
        currentBlock.push(line)
      } else {
        currentBlock.push(line)
      }
    }

    const lastBlockText = currentBlock.join('\n').trim()
    if (lastBlockText) blocks.push(lastBlockText)

    return blocks
  }, [reasoningText])
  const reasoningStreaming = reasoningParts.some(
    (part) => part.state === 'streaming',
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col overflow-hidden gap-0"
      >
        <SheetHeader className="h-10">
          <SheetTitle>Activity</SheetTitle>
        </SheetHeader>
        <Separator />
        <ScrollArea className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          {reasoningBlocks.length > 0 ? (
            <div className="flex flex-col gap-4 py-4">
              {reasoningBlocks.map((block, index) => {
                const isLast = index === reasoningBlocks.length - 1
                return (
                  <div
                    key={`${index}-${block.slice(0, 16)}`}
                    className="flex gap-3"
                  >
                    <div className="flex flex-col items-center pt-1">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          isLast && reasoningStreaming
                            ? 'bg-primary/80 animate-pulse'
                            : 'bg-muted-foreground/60',
                        )}
                      />
                      {!isLast && (
                        <span className="mt-2 w-px flex-1 bg-border/60" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Step {index + 1}
                      </div>
                      <div className="prose prose-sm prose-invert max-w-none">
                        <Streamdown>{block}</Streamdown>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-4 text-sm text-muted-foreground">
              {reasoningStreaming ? (
                <span className="bg-linear-to-r from-foreground/40 via-foreground/90 to-foreground/40 bg-size-[200%_100%] bg-clip-text text-transparent animate-pulse">
                  Thinking...
                </span>
              ) : (
                'No reasoning captured yet.'
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
