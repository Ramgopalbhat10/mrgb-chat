import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { SentIcon } from '@hugeicons/core-free-icons'

interface ChatInputProps {
  input: string
  onInputChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
  isLoading?: boolean
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
}: ChatInputProps) {
  return (
    <div className="p-4 max-w-3xl mx-auto w-full">
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-3 bg-card border border-border rounded-md p-2 focus-within:border-primary/50 transition-colors"
      >
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Ask anything..."
          disabled={isLoading}
          className="ml-2 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <Button
          type="submit"
          disabled={isLoading || !input.trim()}
          size="icon"
          variant="default"
          className="h-8 w-8 text-foreground bg-primary disabled:opacity-30"
        >
          <HugeiconsIcon icon={SentIcon} size={18} strokeWidth={2} />
        </Button>
      </form>
    </div>
  )
}
