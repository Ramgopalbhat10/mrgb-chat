import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ContextUsageProps {
  used: number
  total: number
  className?: string
}

export function ContextUsage({ used, total, className }: ContextUsageProps) {
  const percentage = Math.min(Math.round((used / total) * 100), 100)
  const radius = 8
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger render={
          <div className={cn("relative flex items-center justify-center w-7 h-7 cursor-help rounded-full hover:bg-muted/50 transition-colors", className)}>
            <svg className="w-5 h-5 -rotate-90" viewBox="0 0 24 24">
              {/* Background circle */}
              <circle
                cx="12"
                cy="12"
                r={radius}
                className="stroke-muted-foreground/20 fill-none"
                strokeWidth="2"
              />
              {/* Progress circle */}
              <circle
                cx="12"
                cy="12"
                r={radius}
                className="stroke-foreground fill-none transition-all duration-500 ease-in-out"
                strokeWidth="2"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>
          </div>
        } />
        <TooltipContent side="top" align="center" className="text-[11px] py-1 px-2 bg-popover text-popover-foreground border-border shadow-lg">
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-bold">{percentage}% context used</span>
            <span className="text-[10px] text-muted-foreground">
              ({used.toLocaleString()} / {total.toLocaleString()} tokens)
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
