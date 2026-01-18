import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  SentIcon,
  Attachment01Icon,
  GlobalIcon,
} from '@hugeicons/core-free-icons'
import { ModelSelector } from './model-selector'
import { ContextUsage } from './context-usage'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  availableModelsQueryOptions,
  type ModelMetadata,
} from '@/features/chat/data/queries'
import type { UIMessage } from 'ai'

interface ChatInputProps {
  input: string
  onInputChange: (value: string) => void
  onSubmit: (e: React.FormEvent, modelId?: string) => void
  isLoading?: boolean
  messages?: UIMessage[]
  defaultModelId?: string
  selectedModelId?: string
  onModelChange?: (modelId: string) => void
}

// Default model - Gemini 3 Flash
const DEFAULT_MODEL = 'google/gemini-3-flash'

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  messages = [],
  defaultModelId,
  selectedModelId,
  onModelChange,
}: ChatInputProps) {
  // Track if user has manually selected a model in this session
  const userSelectedRef = useRef(false)
  const [localModelId, setLocalModelId] = useState<string>(
    defaultModelId || DEFAULT_MODEL,
  )
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const effectiveModelId = selectedModelId ?? localModelId

  // Fetch available models to get context window for the selected model
  const { data: models = [] } = useQuery(availableModelsQueryOptions())

  // Get the metadata for the currently selected model in the dropdown
  const selectedModelMetadata = useMemo(() => {
    return models.find((m: ModelMetadata) => m.id === effectiveModelId)
  }, [models, effectiveModelId])

  // Handle model selection - mark as user-selected to prevent auto-reset
  const handleModelSelect = useCallback((modelId: string) => {
    userSelectedRef.current = true
    if (selectedModelId === undefined) {
      setLocalModelId(modelId)
    }
    onModelChange?.(modelId)
  }, [onModelChange, selectedModelId])

  // Only sync with defaultModelId on initial load or when conversation changes
  // Don't override user's manual selection
  const prevDefaultModelId = useRef(defaultModelId)
  useEffect(() => {
    if (selectedModelId !== undefined) return
    // Only sync if conversation changed (different defaultModelId) and user hasn't manually selected
    if (defaultModelId && defaultModelId !== prevDefaultModelId.current) {
      prevDefaultModelId.current = defaultModelId
      if (!userSelectedRef.current) {
        setLocalModelId(defaultModelId)
      }
    }
  }, [defaultModelId, selectedModelId])

  // Calculate token count from actual usage metadata when available
  // Falls back to estimation for messages without metadata
  const tokenCount = useMemo(() => {
    let actualTokens = 0
    let hasActualUsage = false

    // Sum up actual token usage from message metadata
    for (const m of messages) {
      const msg = m as any
      if (msg.metadata?.usage) {
        // Use totalTokens which includes input + output for that turn
        actualTokens += msg.metadata.usage.totalTokens || 0
        hasActualUsage = true
      }
    }

    // If we have actual usage data, use it plus estimation for current input
    if (hasActualUsage) {
      const inputEstimate = Math.ceil(input.length / 4)
      return actualTokens + inputEstimate
    }

    // Fallback: estimate all text at ~4 characters per token
    let totalChars = input.length
    for (const m of messages) {
      const msg = m as any
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length
        continue
      }
      if (m.parts) {
        for (const part of m.parts) {
          if (part.type === 'text') {
            totalChars += (part as any).text?.length ?? 0
          }
        }
      }
    }
    return Math.ceil(totalChars / 4)
  }, [messages, input])

  // Use context window from the currently selected model (updates when dropdown changes)
  const contextWindow = selectedModelMetadata?.context_window || 128000

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [input, resizeTextarea])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(e, effectiveModelId)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    if ((e.nativeEvent as KeyboardEvent).isComposing) return
    e.preventDefault()
    if (isLoading || !input.trim()) return
    formRef.current?.requestSubmit()
  }

  return (
    <div className="p-4 max-w-3xl mx-auto w-full">
      <div className="bg-card border border-border rounded-xl p-2 focus-within:border-primary/50 transition-colors shadow-sm">
        <form
          ref={formRef}
          onSubmit={handleFormSubmit}
          className="flex flex-col gap-2"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            disabled={isLoading}
            rows={1}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none p-2 min-h-10 max-h-48 resize-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap wrap-break-words"
          />
          <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 px-1">
            {/* Left side controls - stack on mobile */}
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
              >
                <HugeiconsIcon
                  icon={Attachment01Icon}
                  size={18}
                  strokeWidth={2}
                />
              </Button>
              <ModelSelector
                selectedModelId={effectiveModelId}
                onSelect={handleModelSelect}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 shrink-0 text-muted-foreground hidden sm:flex"
              >
                <HugeiconsIcon icon={GlobalIcon} size={16} strokeWidth={2} />
                <span className="text-xs font-medium">Search</span>
              </Button>
              {/* Mobile: icon only */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground sm:hidden"
              >
                <HugeiconsIcon icon={GlobalIcon} size={16} strokeWidth={2} />
              </Button>
            </div>
            {/* Right side - context usage and send */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:block">
                <ContextUsage used={tokenCount} total={contextWindow} />
              </div>
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                size="icon"
                variant="default"
                className="h-8 w-8 shrink-0 text-foreground bg-primary disabled:opacity-30 rounded-lg"
              >
                <HugeiconsIcon icon={SentIcon} size={18} strokeWidth={2} />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
