import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  availableModelsQueryOptions,
  ModelMetadata,
} from '@/features/chat/data/queries'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  CoinsIcon,
  BrainIcon,
  AiBrain01Icon,
  FilterIcon,
} from '@hugeicons/core-free-icons'
import {
  OpenAI,
  Anthropic,
  Google,
  Meta,
  Mistral,
  DeepSeek,
  Cohere,
  Perplexity,
  Aws,
  Azure,
  Groq,
  Together,
  Fireworks,
  Alibaba,
  Gemini,
  Qwen,
  Nvidia,
  Voyage,
} from '@lobehub/icons/es/icons'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

// Map provider keys to icon components
const PROVIDER_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  openai: OpenAI,
  anthropic: Anthropic,
  google: Google,
  meta: Meta,
  mistral: Mistral,
  mistralai: Mistral,
  deepseek: DeepSeek,
  cohere: Cohere,
  perplexity: Perplexity,
  perplexityai: Perplexity,
  aws: Aws,
  azure: Azure,
  groq: Groq,
  together: Together,
  fireworks: Fireworks,
  alibaba: Alibaba,
  gemini: Gemini,
  qwen: Qwen,
  nvidia: Nvidia,
  voyage: Voyage,
}

interface ModelSelectorProps {
  selectedModelId?: string
  onSelect: (modelId: string) => void
  className?: string
  trigger?: React.ReactElement
  contentSide?: 'top' | 'right' | 'bottom' | 'left'
  contentAlign?: 'start' | 'center' | 'end'
  contentSideOffset?: number
  contentAlignOffset?: number
  contentClassName?: string
}

function ModelSelectorComponent({
  selectedModelId,
  onSelect,
  className,
  trigger,
  contentSide = 'bottom',
  contentAlign = 'start',
  contentSideOffset = 4,
  contentAlignOffset = 0,
  contentClassName,
}: ModelSelectorProps) {
  const [search, setSearch] = React.useState('')
  const [selectedTags, setSelectedTags] = React.useState<Array<string>>([])
  const [showFilters, setShowFilters] = React.useState(false)
  const filterButtonRef = React.useRef<HTMLSpanElement>(null)
  const filtersPanelRef = React.useRef<HTMLDivElement>(null)
  const { data: models = [], isLoading } = useQuery(
    availableModelsQueryOptions(),
  )

  const availableTags = React.useMemo(() => {
    const tagSet = new Set<string>()
    for (const model of models) {
      if (!model.tags) continue
      for (const tag of model.tags) {
        tagSet.add(tag)
      }
    }
    return Array.from(tagSet).sort()
  }, [models])

  const filteredModels = React.useMemo(() => {
    const trimmedSearch = search.trim().toLowerCase()
    const hasSearch = trimmedSearch.length > 0
    const hasTagFilters = selectedTags.length > 0

    return models.filter((model) => {
      if (hasSearch) {
        const matchesSearch =
          model.name?.toLowerCase().includes(trimmedSearch) ||
          model.id?.toLowerCase().includes(trimmedSearch) ||
          model.owned_by?.toLowerCase().includes(trimmedSearch)
        if (!matchesSearch) return false
      }

      if (hasTagFilters) {
        const modelTags = model.tags ?? []
        const matchesTags = selectedTags.every((tag) => modelTags.includes(tag))
        if (!matchesTags) return false
      }

      return true
    })
  }, [models, search, selectedTags])

  const selectedModel = React.useMemo(
    () => models.find((m) => m.id === selectedModelId) || models[0],
    [models, selectedModelId],
  )

  const groupedModels = React.useMemo(() => {
    return filteredModels.reduce(
      (acc, model) => {
        let providerKey = (model.owned_by || '').toLowerCase()

        // Infer provider from ID if owned_by is generic or missing
        if (
          (!providerKey ||
            providerKey === 'other' ||
            providerKey === 'system' ||
            providerKey === 'openai') &&
          model.id.includes('/')
        ) {
          const parts = model.id.split('/')
          if (parts[0]) providerKey = parts[0].toLowerCase()
        }

        // Map common variations
        if (providerKey === 'google' && model.id.includes('gemini'))
          providerKey = 'gemini'
        if (
          providerKey === 'alibaba' &&
          model.id.toLowerCase().includes('qwen')
        )
          providerKey = 'qwen'

        if (!acc[providerKey]) acc[providerKey] = []
        acc[providerKey].push(model)
        return acc
      },
      {} as Record<string, ModelMetadata[]>,
    )
  }, [filteredModels])

  const renderIcon = React.useCallback(
    (provider: string | undefined | null, size = 16) => {
      if (!provider) return null
      const normalizedKey = provider.toLowerCase()

      // Check our map for the icon component
      const IconComponent = PROVIDER_ICONS[normalizedKey]

      if (!IconComponent) {
        // Fallback to a generic AI icon
        return (
          <HugeiconsIcon
            icon={AiBrain01Icon}
            size={size}
            className="text-muted-foreground"
          />
        )
      }

      return (
        <IconComponent size={size} className="text-foreground fill-current" />
      )
    },
    [],
  )

  const handleTagToggle = React.useCallback((tag: string) => {
    setSelectedTags((current) => {
      if (current.includes(tag)) {
        return current.filter((item) => item !== tag)
      }
      return [...current, tag]
    })
  }, [])

  React.useEffect(() => {
    if (!showFilters) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (
        filterButtonRef.current?.contains(target) ||
        filtersPanelRef.current?.contains(target)
      ) {
        return
      }
      setShowFilters(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [showFilters])

  const handleSelect = React.useCallback(
    (modelId: string) => {
      onSelect(modelId)
    },
    [onSelect],
  )

  const triggerElement =
    trigger ??
    (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'flex items-center gap-2 px-2 h-9 font-medium text-muted-foreground hover:text-foreground transition-colors',
          className,
        )}
        disabled={isLoading}
      >
        {selectedModel && (
          <>
            {renderIcon(selectedModel.owned_by)}
            <span className="truncate max-w-[120px]">
              {selectedModel.name}
            </span>
            {selectedModel.tags?.includes('reasoning') && (
              <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Pro
              </span>
            )}
          </>
        )}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          className="ml-1 opacity-50"
        />
      </Button>
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={triggerElement} />
      <DropdownMenuContent
        align={contentAlign}
        alignOffset={contentAlignOffset}
        side={contentSide}
        sideOffset={contentSideOffset}
        className={cn(
          'w-[300px] max-h-[500px] overflow-y-auto p-1 bg-popover border-border',
          contentClassName,
        )}
      >
        <div className="sticky top-0 z-10 bg-popover pb-2">
          <Accordion
            value={showFilters ? ['filters'] : []}
            onValueChange={(value) =>
              setShowFilters(value.includes('filters'))
            }
          >
            <AccordionItem value="filters" className="border-0">
              <div
                className="px-2 py-1.5 flex items-center gap-2"
                onKeyDown={(e) => {
                  // Prevent menu keyboard navigation while typing
                  if (e.key !== 'Escape') {
                    e.stopPropagation()
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Input
                  type="text"
                  placeholder="Search Models..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 rounded bg-muted/50 px-2 py-1 text-xs focus:outline-none placeholder:text-muted-foreground/50"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <span ref={filterButtonRef} className="relative">
                  <AccordionTrigger
                    className="flex-none h-8 w-8 p-0 bg-secondary hover:no-underline rounded-md **:data-[slot=accordion-trigger-icon]:hidden"
                    aria-label="Toggle filters"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <span className="relative flex h-8 w-8 items-center justify-center text-secondary-foreground hover:text-foreground">
                      <HugeiconsIcon icon={FilterIcon} size={16} strokeWidth={2} />
                      {selectedTags.length > 0 ? (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground px-1">
                          {selectedTags.length}
                        </span>
                      ) : null}
                    </span>
                  </AccordionTrigger>
                </span>
              </div>
              <AccordionContent className="px-2 pt-1">
                <div ref={filtersPanelRef}>
                  {availableTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {availableTags.map((tag) => {
                        const isSelected = selectedTags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTagToggle(tag)
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                              isSelected
                                ? 'border-primary/40 bg-primary/15 text-primary'
                                : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                            )}
                          >
                            {tag.replace(/-/g, ' ')}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <div className="border-b border-border/60" />
        </div>
        {Object.entries(groupedModels).map(([providerKey, providerModels]) => {
          const displayLabel =
            providerKey.charAt(0).toUpperCase() + providerKey.slice(1)

          return (
            <div key={providerKey} className="mb-2">
              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                {renderIcon(providerKey, 12)}
                {displayLabel}
              </div>
              {providerModels.map((model) => (
                <ModelItem
                  key={model.id}
                  model={model}
                  isSelected={selectedModel?.id === model.id}
                  onSelect={() => handleSelect(model.id)}
                  renderIcon={renderIcon}
                />
              ))}
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const ModelSelector = React.memo(ModelSelectorComponent)
ModelSelector.displayName = 'ModelSelector'

function ModelItem({
  model,
  isSelected,
  onSelect,
  renderIcon,
}: {
  model: ModelMetadata
  isSelected: boolean
  onSelect: () => void
  renderIcon: (provider: string, size?: number) => React.ReactNode
}) {
  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuItem
              className={cn(
                'flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer rounded-sm transition-colors',
                isSelected
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50',
              )}
              onClick={onSelect}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {renderIcon(model.owned_by)}
                <span className="truncate text-sm">{model.name}</span>
              </div>
              {model.tags?.includes('reasoning') && (
                <span className="bg-primary text-primary-foreground text-[9px] px-1 rounded font-bold uppercase tracking-wider">
                  Pro
                </span>
              )}
            </DropdownMenuItem>
          }
        />
        <TooltipContent
          side="right"
          sideOffset={10}
          className="w-[320px] p-0 bg-card border-border shadow-xl overflow-hidden"
        >
          <div className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-muted">
                  {renderIcon(model.owned_by, 20)}
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider leading-none mb-1">
                    {model.owned_by}
                  </div>
                  <div className="text-sm font-bold leading-none text-muted-foreground">
                    {model.name}
                  </div>
                </div>
              </div>
            </div>

            {model.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {model.description}
              </p>
            )}

            <div className="flex flex-wrap gap-1 mt-1">
              {model.tags?.map((tag) => {
                const tagStyles: Record<string, string> = {
                  reasoning:
                    'bg-amber-500/10 text-amber-500 border-amber-500/20',
                  vision: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                  'file-input':
                    'bg-purple-500/10 text-purple-500 border-purple-500/20',
                  'tool-use':
                    'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                  'implicit-caching':
                    'bg-orange-500/10 text-orange-500 border-orange-500/20',
                  'image-generation':
                    'bg-pink-500/10 text-pink-500 border-pink-500/20',
                }
                const style =
                  tagStyles[tag] ||
                  'bg-secondary text-secondary-foreground border-border'
                return (
                  <span
                    key={tag}
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider',
                      style,
                    )}
                  >
                    {tag}
                  </span>
                )
              })}
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <HugeiconsIcon icon={BrainIcon} size={12} />
                  <span>Context</span>
                </div>
                <span className="font-medium text-muted-foreground">
                  {model.context_window?.toLocaleString()} tokens
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <HugeiconsIcon icon={CoinsIcon} size={12} />
                  <span>Input Pricing</span>
                </div>
                <span className="font-medium text-muted-foreground">
                  ${(Number(model.pricing?.input) * 1_000_000).toFixed(2)} /
                  million tokens
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <HugeiconsIcon icon={CoinsIcon} size={12} />
                  <span>Output Pricing</span>
                </div>
                <span className="font-medium text-muted-foreground">
                  ${(Number(model.pricing?.output) * 1_000_000).toFixed(2)} /
                  million tokens
                </span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
