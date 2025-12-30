import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CoinsIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface MessageUsage {
  // AI SDK uses these field names
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
  // Gateway provides the actual cost
  gatewayCost?: string
  // Legacy field names (for compatibility)
  promptTokens?: number
  completionTokens?: number
}

interface MessageUsageProps {
  usage?: MessageUsage
  modelId?: string
}

export function MessageUsageIndicator({ usage, modelId }: MessageUsageProps) {
  // Use AI SDK field names (inputTokens/outputTokens) with fallback to legacy names
  const inputTokens = usage?.inputTokens ?? usage?.promptTokens ?? 0
  const outputTokens = usage?.outputTokens ?? usage?.completionTokens ?? 0
  const reasoningTokens = usage?.reasoningTokens ?? 0
  const totalTokens = usage?.totalTokens ?? (inputTokens + outputTokens)
  
  const hasUsage = usage && (totalTokens > 0 || inputTokens > 0 || outputTokens > 0)

  // Use gateway cost directly if available (from providerMetadata.gateway.cost)
  const cost = usage?.gatewayCost ? parseFloat(usage.gatewayCost) : null

  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return n.toString()
  }

  const formatCost = (c: number) => {
    if (c < 0.0001) return '< $0.0001'
    if (c < 0.01) return `$${c.toFixed(4)}`
    return `$${c.toFixed(3)}`
  }

  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <HugeiconsIcon icon={CoinsIcon} size={15} strokeWidth={2} />
        </Button>
      } />
      <PopoverContent 
        side="bottom" 
        sideOffset={4}
        className="w-[220px] p-0 bg-popover border-border shadow-xl"
      >
        <div className="p-3 space-y-2.5">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <HugeiconsIcon icon={CoinsIcon} size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Token Usage</span>
          </div>
          
          {hasUsage ? (
            <>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Input tokens</span>
                  <span className="font-medium text-foreground">{formatTokens(inputTokens)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Output tokens</span>
                  <span className="font-medium text-foreground">{formatTokens(outputTokens)}</span>
                </div>
                {reasoningTokens > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Reasoning tokens</span>
                    <span className="font-medium text-foreground">{formatTokens(reasoningTokens)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] pt-1 border-t border-border/50">
                  <span className="text-muted-foreground font-medium">Total</span>
                  <span className="font-bold text-foreground">{formatTokens(totalTokens)}</span>
                </div>
              </div>

              {cost !== null && cost > 0 && (
                <div className="flex justify-between text-[11px] pt-2 border-t border-border">
                  <span className="text-muted-foreground">Estimated cost</span>
                  <span className="font-bold text-emerald-500">{formatCost(cost)}</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No token usage data found.
            </p>
          )}

          {modelId && (
            <div className="text-[10px] text-muted-foreground/60 pt-1 truncate">
              {modelId}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
