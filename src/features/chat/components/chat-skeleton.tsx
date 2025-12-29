import { Skeleton } from '@/components/ui/skeleton'
import { ChatInput } from './chat-input'

export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-150">
      {/* Header skeleton - matches ChatHeader height */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <Skeleton className="h-5 w-48" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Messages skeleton with fading effect */}
      <div className="flex-1 overflow-hidden">
        <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
          {/* User message skeleton */}
          <div className="flex flex-col gap-1.5 items-end opacity-100">
            <Skeleton className="h-10 w-[70%] rounded-md" />
          </div>

          {/* Assistant message skeleton - fading */}
          <div className="flex flex-col gap-1.5 items-start opacity-60">
            <Skeleton className="h-4 w-[90%] rounded-md" />
            <Skeleton className="h-4 w-[85%] rounded-md" />
            <Skeleton className="h-4 w-[75%] rounded-md" />
            <Skeleton className="h-4 w-[60%] rounded-md" />
          </div>

          {/* Faded user message */}
          <div className="flex flex-col gap-1.5 items-end opacity-30">
            <Skeleton className="h-10 w-[55%] rounded-md" />
          </div>

          {/* Faded assistant message */}
          <div className="flex flex-col gap-1.5 items-start opacity-15">
            <Skeleton className="h-4 w-[80%] rounded-md" />
            <Skeleton className="h-4 w-[70%] rounded-md" />
            <Skeleton className="h-4 w-[50%] rounded-md" />
          </div>
        </div>
      </div>

      {/* Actual ChatInput - no border, disabled state */}
      <ChatInput
        input=""
        onInputChange={() => {}}
        onSubmit={(e) => e.preventDefault()}
        isLoading={true}
      />
    </div>
  )
}
