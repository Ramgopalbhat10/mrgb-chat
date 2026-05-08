import { HugeiconsIcon } from '@hugeicons/react'
import { GlobalIcon } from '@hugeicons/core-free-icons'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface SearchProvider {
  id: string
  label: string
  description: string
  available: boolean
}

const PROVIDERS: ReadonlyArray<SearchProvider> = [
  {
    id: 'parallel',
    label: 'Parallel',
    description: 'Web search via Parallel AI',
    available: true,
  },
]

interface SearchProviderPickerProps {
  enabled: boolean
  onToggle: (next: boolean) => void
}

export function SearchProviderPicker({
  enabled,
  onToggle,
}: SearchProviderPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Web search providers"
            aria-pressed={enabled}
            className={cn(
              'h-8 shrink-0 px-2 sm:gap-1.5',
              enabled
                ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                : 'text-muted-foreground',
            )}
          >
            <HugeiconsIcon icon={GlobalIcon} size={16} strokeWidth={2} />
            <span className="hidden sm:inline text-xs font-medium">Search</span>
          </Button>
        }
      />
      <PopoverContent align="start" side="top" className="w-72 p-2 gap-1">
        <PopoverHeader className="px-2 pt-1 pb-2">
          <PopoverTitle>Web search</PopoverTitle>
        </PopoverHeader>
        <ul className="flex flex-col gap-1">
          {PROVIDERS.map((provider) => {
            const isActive = provider.available && enabled && provider.id === 'parallel'
            const handleClick = () => {
              if (!provider.available) return
              onToggle(!enabled)
            }
            return (
              <li key={provider.id}>
                <button
                  type="button"
                  disabled={!provider.available}
                  onClick={handleClick}
                  aria-pressed={isActive}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                    provider.available
                      ? 'hover:bg-accent cursor-pointer'
                      : 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <HugeiconsIcon
                    icon={GlobalIcon}
                    size={18}
                    strokeWidth={2}
                    className={cn(
                      'shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {provider.label}
                      </span>
                      {!provider.available ? (
                        <span className="text-[10px] uppercase tracking-wide rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                          Coming soon
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {provider.description}
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                      isActive ? 'bg-primary' : 'bg-muted-foreground/30',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform',
                        isActive ? 'translate-x-4' : 'translate-x-0.5',
                      )}
                    />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
