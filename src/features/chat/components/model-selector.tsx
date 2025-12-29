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
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, CoinsIcon, BrainIcon, AiBrain01Icon } from '@hugeicons/core-free-icons'
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
} from '@lobehub/icons'
import { cn } from '@/lib/utils'

// Map provider keys to icon components
const PROVIDER_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
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
}

interface ModelSelectorProps {
  selectedModelId?: string
  onSelect: (modelId: string) => void
  className?: string
}

export function ModelSelector({
  selectedModelId,
  onSelect,
  className,
}: ModelSelectorProps) {
  const [search, setSearch] = React.useState('')
  const { data: models = [], isLoading } = useQuery(availableModelsQueryOptions())

  const filteredModels = React.useMemo(() => {
    if (!search.trim()) return models
    const s = search.toLowerCase()
    return models.filter(
      (m) =>
        m.name?.toLowerCase().includes(s) ||
        m.id?.toLowerCase().includes(s) ||
        m.owned_by?.toLowerCase().includes(s),
    )
  }, [models, search])

  const selectedModel = React.useMemo(
    () => models.find((m) => m.id === selectedModelId) || models[0],
    [models, selectedModelId],
  )

  const groupedModels = React.useMemo(() => {
    return filteredModels.reduce(
      (acc, model) => {
        let providerKey = (model.owned_by || '').toLowerCase()
        
        // Infer provider from ID if owned_by is generic or missing
        if ((!providerKey || providerKey === 'other' || providerKey === 'system' || providerKey === 'openai') && model.id.includes('/')) {
          const parts = model.id.split('/')
          if (parts[0]) providerKey = parts[0].toLowerCase()
        }
        
        // Map common variations
        if (providerKey === 'google' && model.id.includes('gemini')) providerKey = 'gemini'
        if (providerKey === 'alibaba' && model.id.toLowerCase().includes('qwen')) providerKey = 'qwen'

        if (!acc[providerKey]) acc[providerKey] = []
        acc[providerKey].push(model)
        return acc
      },
      {} as Record<string, ModelMetadata[]>,
    )
  }, [filteredModels])

  const renderIcon = React.useCallback((provider: string | undefined | null, size = 16) => {
    if (!provider) return null
    const normalizedKey = provider.toLowerCase()
    
    // Check our map for the icon component
    const IconComponent = PROVIDER_ICONS[normalizedKey]
    
    if (!IconComponent) {
      // Fallback to a generic AI icon
      return <HugeiconsIcon icon={AiBrain01Icon} size={size} className="text-muted-foreground" />
    }
    
    return <IconComponent size={size} className="text-foreground fill-current" />
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button
          variant="ghost"
          size="sm"
          className={cn(
            'flex items-center gap-2 px-2 h-9 font-medium text-muted-foreground hover:text-foreground transition-colors',
            className
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
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} className="ml-1 opacity-50" />
        </Button>} />
      <DropdownMenuContent
        align="start"
        className="w-[300px] max-h-[500px] overflow-y-auto p-1 bg-popover border-border"
      >
        <div 
          className="px-2 py-1.5" 
          onKeyDown={(e) => {
            // Prevent menu keyboard navigation while typing
            if (e.key !== 'Escape') {
              e.stopPropagation()
            }
          }} 
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            placeholder="Search Models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-muted/50 border-none rounded px-2 py-1 text-xs focus:outline-none placeholder:text-muted-foreground/50"
            autoFocus
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
        {Object.entries(groupedModels).map(([providerKey, providerModels]) => {
          const displayLabel = providerKey.charAt(0).toUpperCase() + providerKey.slice(1)
          
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
                  onSelect={() => onSelect(model.id)}
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
        <TooltipTrigger render={<DropdownMenuItem
            className={cn(
              'flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer rounded-sm transition-colors',
              isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
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
          </DropdownMenuItem>} />
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
                  <div className="text-sm font-bold leading-none text-muted-foreground">{model.name}</div>
                </div>
              </div>
            </div>

            {model.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {model.description}
              </p>
            )}

            <div className="flex flex-wrap gap-1 mt-1">
              {model.tags?.map(tag => {
                const tagStyles: Record<string, string> = {
                  'reasoning': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                  'vision': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                  'file-input': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
                  'tool-use': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                  'implicit-caching': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
                  'image-generation': 'bg-pink-500/10 text-pink-500 border-pink-500/20',
                }
                const style = tagStyles[tag] || 'bg-secondary text-secondary-foreground border-border'
                return (
                  <span key={tag} className={cn("text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider", style)}>
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
                <span className="font-medium text-muted-foreground">{model.context_window?.toLocaleString()} tokens</span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <HugeiconsIcon icon={CoinsIcon} size={12} />
                  <span>Input Pricing</span>
                </div>
                <span className="font-medium text-muted-foreground">${(Number(model.pricing?.input) * 1_000_000).toFixed(2)} / million tokens</span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <HugeiconsIcon icon={CoinsIcon} size={12} />
                  <span>Output Pricing</span>
                </div>
                <span className="font-medium text-muted-foreground">${(Number(model.pricing?.output) * 1_000_000).toFixed(2)} / million tokens</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
