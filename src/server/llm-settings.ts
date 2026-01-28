import { redis } from '@/server/cache/redis'
import { cacheKeys } from '@/server/cache/keys'
import {
  DEFAULT_LLM_SETTINGS,
  type LlmSettings,
  normalizeLlmSettings,
} from '@/lib/llm-settings'

const SETTINGS_KEY = cacheKeys.llmSettings()

const buildDefaultSettings = (): LlmSettings => ({
  ...DEFAULT_LLM_SETTINGS,
  modelId: process.env.AI_MODEL ?? DEFAULT_LLM_SETTINGS.modelId,
})

const parseStoredSettings = (value: unknown): LlmSettings | null => {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as LlmSettings
    } catch {
      return null
    }
  }
  if (typeof value === 'object') {
    return value as LlmSettings
  }
  return null
}

export async function getLlmSettings(): Promise<LlmSettings> {
  const defaults = buildDefaultSettings()
  if (!redis) return defaults

  try {
    const stored = await redis.get(SETTINGS_KEY)
    const parsed = parseStoredSettings(stored)
    if (!parsed) return defaults

    return {
      ...defaults,
      ...normalizeLlmSettings(parsed),
    }
  } catch (error) {
    console.error('Failed to load LLM settings from Redis:', error)
    return defaults
  }
}

export async function setLlmSettings(
  updates: Partial<LlmSettings>,
): Promise<LlmSettings> {
  const current = await getLlmSettings()
  const next: LlmSettings = {
    ...current,
    ...normalizeLlmSettings(updates),
  }

  if (!redis) return next

  try {
    await redis.set(SETTINGS_KEY, JSON.stringify(next))
  } catch (error) {
    console.error('Failed to persist LLM settings to Redis:', error)
  }

  return next
}
