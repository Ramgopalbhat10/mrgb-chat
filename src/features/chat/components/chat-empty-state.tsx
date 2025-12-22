import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Attachment01Icon,
  AiBrain01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'

export function ChatEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="text-center max-w-lg">
        <h1 className="text-2xl font-medium text-foreground mb-2">
          What can I help you with?
        </h1>
        <p className="text-sm text-muted-foreground/70 mb-8">
          Ask me anything. I can help with writing, analysis, coding, math, and
          more.
        </p>

        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs gap-2 bg-card border-border hover:bg-accent"
          >
            <HugeiconsIcon
              icon={Attachment01Icon}
              size={14}
              strokeWidth={2}
              className="text-muted-foreground"
            />
            Attach file
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs gap-2 bg-card border-border hover:bg-accent"
          >
            <HugeiconsIcon
              icon={AiBrain01Icon}
              size={14}
              strokeWidth={2}
              className="text-muted-foreground"
            />
            Select model
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs gap-2 bg-card border-border hover:bg-accent"
          >
            <HugeiconsIcon
              icon={Search01Icon}
              size={14}
              strokeWidth={2}
              className="text-muted-foreground"
            />
            Web search
          </Button>
        </div>
      </div>
    </div>
  )
}
