import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { Settings01Icon, ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { ModelSelector } from '@/features/chat/components/chat/model-selector'
import {
  llmSettingsKeys,
  llmSettingsQueryOptions,
} from '@/features/llm-settings/data/queries'
import { useUpdateLlmSettings } from '@/features/llm-settings/data/mutations'
import { DEFAULT_LLM_SETTINGS, type LlmSettings } from '@/lib/llm-settings'
import { cn } from '@/lib/utils'

const temperatureLabel = (value: number) => {
  if (value <= 0.25) return 'Precise'
  if (value <= 0.6) return 'Balanced'
  if (value <= 0.9) return 'Creative'
  return 'Wild'
}

const formatNumber = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : '—'

const toSingleValue = (value: number | readonly number[]) =>
  Array.isArray(value) ? value[0] : value

const toNumberInput = (value: number | undefined) =>
  typeof value === 'number' ? String(value) : ''

const parseNumberInput = (value: string) => {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

type NumericFieldKey =
  | 'maxOutputTokens'
  | 'temperature'
  | 'topP'
  | 'topK'
  | 'presencePenalty'
  | 'frequencyPenalty'

type TextFieldKey = 'systemPrompt'

export function LlmSettingsPanel() {
  const { data: settings, isLoading } = useQuery(llmSettingsQueryOptions())
  const queryClient = useQueryClient()
  const updateSettings = useUpdateLlmSettings()
  const [draft, setDraft] = useState<LlmSettings>(DEFAULT_LLM_SETTINGS)
  const [savedSettings, setSavedSettings] = useState<LlmSettings | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState<string | null>(null)
  const hasHydratedRef = useRef(false)

  const isDirty = useMemo(() => {
    if (!savedSettings) return false
    return JSON.stringify(savedSettings) !== JSON.stringify(draft)
  }, [draft, savedSettings])

  useEffect(() => {
    if (!settings) return
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true
      setDraft(settings)
      setSavedSettings(settings)
      return
    }
    if (!isDirty && !updateSettings.isPending) {
      setDraft(settings)
      setSavedSettings(settings)
    }
  }, [isDirty, settings, updateSettings.isPending])

  const handleSave = () => {
    updateSettings.mutate(draft, {
      onSuccess: (data) => {
        setDraft(data)
        setSavedSettings(data)
      },
    })
  }

  const handleReset = () => {
    setDraft(DEFAULT_LLM_SETTINGS)
    updateSettings.mutate(DEFAULT_LLM_SETTINGS, {
      onSuccess: (data) => {
        setDraft(data)
        setSavedSettings(data)
      },
    })
  }

  const handleModelSelect = (modelId: string) => {
    setDraft((prev) => ({ ...prev, modelId }))
    queryClient.setQueryData<LlmSettings>(llmSettingsKeys.all, (current) => {
      const base = current ?? DEFAULT_LLM_SETTINGS
      return { ...base, modelId }
    })
  }

  const handleNumberField =
    (key: NumericFieldKey) => (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = parseNumberInput(event.target.value)
      setDraft((prev) => ({ ...prev, [key]: nextValue }))
    }

  const handleTextField =
    (key: TextFieldKey) => (event: ChangeEvent<HTMLTextAreaElement>) => {
      setDraft((prev) => ({ ...prev, [key]: event.target.value }))
    }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
            <HugeiconsIcon icon={Settings01Icon} size={16} strokeWidth={2} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">
              Settings
            </div>
            <p className="text-xs text-muted-foreground">
              Fine-tune generation defaults for your assistant.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="space-y-1">
            <div className="text-base font-semibold text-foreground">Model</div>
            <p className="text-xs text-muted-foreground">
              Choose defaults for the model and its overall behavior.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Model
            </div>
            <ModelSelector
              selectedModelId={draft.modelId}
              onSelect={handleModelSelect}
              trigger={
                <Button
                  variant="outline"
                  className="w-full justify-between gap-2 text-sm"
                >
                  <span className="truncate">
                    {draft.modelId ?? 'Select model'}
                  </span>
                  <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
                </Button>
              }
              contentAlign="start"
              contentSide="bottom"
              contentSideOffset={8}
              contentAlignOffset={0}
              contentClassName="min-w-[280px]"
            />
            <p className="text-xs text-muted-foreground">
              Default model used for new generations.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-3">
            <div className="flex items-center justify-between text-sm font-medium text-foreground">
              <span>Temperature</span>
              <span className="text-xs text-muted-foreground">
                {formatNumber(draft.temperature ?? 0)}
              </span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[draft.temperature ?? 0]}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  temperature: toSingleValue(value),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              {temperatureLabel(draft.temperature ?? 0)} responses.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Max tokens
            </div>
            <Input
              type="number"
              min={0}
              value={toNumberInput(draft.maxOutputTokens)}
              onChange={handleNumberField('maxOutputTokens')}
              placeholder="1500"
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              System prompt
            </div>
            <Textarea
              value={draft.systemPrompt ?? ''}
              onChange={handleTextField('systemPrompt')}
              rows={3}
              placeholder="Set global guidance."
              className="text-sm"
            />
          </div>

          <Accordion
            multiple={false}
            value={advancedOpen ? [advancedOpen] : []}
            onValueChange={(value) => setAdvancedOpen(value[0] ?? null)}
          >
            <AccordionItem
              value="advanced"
              className="rounded-xl border border-border/60 bg-card/40 px-3"
            >
              <AccordionTrigger className="py-2 text-sm">
                Advanced sampling
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>Top P</span>
                      <span className="text-xs text-muted-foreground">
                        {formatNumber(draft.topP ?? 1, 2)}
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={[draft.topP ?? 1]}
                      onValueChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          topP: toSingleValue(value),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>Top K</span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(draft.topK ?? 0)}
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={200}
                      step={1}
                      value={[draft.topK ?? 0]}
                      onValueChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          topK: toSingleValue(value),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>Frequency penalty</span>
                      <span className="text-xs text-muted-foreground">
                        {formatNumber(draft.frequencyPenalty ?? 0, 2)}
                      </span>
                    </div>
                    <Slider
                      min={-2}
                      max={2}
                      step={0.1}
                      value={[draft.frequencyPenalty ?? 0]}
                      onValueChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          frequencyPenalty: toSingleValue(value),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>Presence penalty</span>
                      <span className="text-xs text-muted-foreground">
                        {formatNumber(draft.presencePenalty ?? 0, 2)}
                      </span>
                    </div>
                    <Slider
                      min={-2}
                      max={2}
                      step={0.1}
                      value={[draft.presencePenalty ?? 0]}
                      onValueChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          presencePenalty: toSingleValue(value),
                        }))
                      }
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      <div className="border-t border-border/60 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isLoading && <span>Loading settings...</span>}
            {!isLoading && !isDirty && (
              <span className={cn(updateSettings.isPending && 'opacity-60')}>
                All changes saved
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={updateSettings.isPending}
              size="sm"
            >
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isDirty || updateSettings.isPending || isLoading}
              className="bg-emerald-600 text-white hover:bg-emerald-600/90"
              size="sm"
            >
              {updateSettings.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
