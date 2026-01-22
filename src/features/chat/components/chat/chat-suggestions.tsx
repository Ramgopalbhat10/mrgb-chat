import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowTurnDownIcon } from '@hugeicons/core-free-icons'
import { Skeleton } from '@/components/ui/skeleton'

interface ChatSuggestionsProps {
  suggestions: string[]
  onSelect?: (suggestion: string) => void
}

export function ChatSuggestions({ suggestions, onSelect }: ChatSuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="mt-6 border-t border-border/50 pt-4">
      <div className="text-xs font-medium text-muted-foreground/70 uppercase tracking-[0.2em] mb-3">
        Related
      </div>
      <div className="divide-y divide-border/40">
        {suggestions.map((suggestion, index) => (
          <button
            key={`${index}-${suggestion}`}
            type="button"
            onClick={() => onSelect?.(suggestion)}
            className="group w-full flex items-center gap-3 py-2.5 text-left text-sm text-foreground/90 hover:text-foreground transition-colors"
          >
            <HugeiconsIcon
              icon={ArrowTurnDownIcon}
              size={16}
              strokeWidth={2}
              className="text-muted-foreground group-hover:text-foreground"
            />
            <span className="flex-1 truncate">{suggestion}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function ChatSuggestionsSkeleton() {
  return (
    <div className="mt-6 border-t border-border/50 pt-4">
      <div className="text-xs font-medium text-muted-foreground/70 uppercase tracking-[0.2em] mb-3">
        Related
      </div>
      <div className="divide-y divide-border/40">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={`suggestion-skeleton-${index}`}
            className="flex items-center gap-3 py-2.5"
          >
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-[75%]" />
          </div>
        ))}
      </div>
    </div>
  )
}
