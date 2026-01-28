export type LlmSettings = {
  modelId?: string
  temperature?: number
  maxOutputTokens?: number
  topP?: number
  topK?: number
  presencePenalty?: number
  frequencyPenalty?: number
  stopSequences?: string[]
  seed?: number
  maxRetries?: number
  timeoutMs?: number
  systemPrompt?: string
}

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  modelId: 'google/gemini-3-flash',
  temperature: 0.6,
  maxOutputTokens: 1500,
  topP: 0.9,
  topK: 40,
  presencePenalty: 0,
  frequencyPenalty: 0,
  stopSequences: [],
  maxRetries: 2,
  timeoutMs: 0,
  systemPrompt:
    'You are an AI assistant that helps answer user questions clearly and helpfully.',
}

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const toInteger = (value: unknown) => {
  const parsed = toNumber(value)
  if (parsed === undefined) return undefined
  return Math.trunc(parsed)
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export function normalizeLlmSettings(input: Partial<LlmSettings>): LlmSettings {
  const temperature = toNumber(input.temperature)
  const maxOutputTokens = toInteger(input.maxOutputTokens)
  const topP = toNumber(input.topP)
  const topK = toInteger(input.topK)
  const presencePenalty = toNumber(input.presencePenalty)
  const frequencyPenalty = toNumber(input.frequencyPenalty)
  const seed = toInteger(input.seed)
  const maxRetries = toInteger(input.maxRetries)
  const timeoutMs = toInteger(input.timeoutMs)

  const stopSequences = Array.isArray(input.stopSequences)
    ? input.stopSequences
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0)
    : undefined

  return {
    modelId:
      typeof input.modelId === 'string' && input.modelId.trim().length > 0
        ? input.modelId.trim()
        : undefined,
    temperature:
      temperature === undefined ? undefined : clamp(temperature, 0, 2),
    maxOutputTokens:
      maxOutputTokens === undefined || maxOutputTokens <= 0
        ? undefined
        : maxOutputTokens,
    topP: topP === undefined ? undefined : clamp(topP, 0, 1),
    topK: topK === undefined || topK <= 0 ? undefined : topK,
    presencePenalty:
      presencePenalty === undefined
        ? undefined
        : clamp(presencePenalty, -2, 2),
    frequencyPenalty:
      frequencyPenalty === undefined
        ? undefined
        : clamp(frequencyPenalty, -2, 2),
    stopSequences,
    seed: seed === undefined ? undefined : seed,
    maxRetries:
      maxRetries === undefined || maxRetries < 0 ? undefined : maxRetries,
    timeoutMs:
      timeoutMs === undefined || timeoutMs < 0 ? undefined : timeoutMs,
    systemPrompt:
      typeof input.systemPrompt === 'string'
        ? input.systemPrompt
        : undefined,
  }
}
