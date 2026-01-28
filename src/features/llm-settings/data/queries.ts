import { queryOptions } from '@tanstack/react-query'
import type { LlmSettings } from '@/lib/llm-settings'

export const llmSettingsKeys = {
  all: ['llm-settings'] as const,
}

async function fetchLlmSettings(): Promise<LlmSettings> {
  const response = await fetch('/api/llm-settings')
  if (!response.ok) {
    throw new Error('Failed to fetch LLM settings')
  }
  return response.json()
}

export const llmSettingsQueryOptions = () =>
  queryOptions({
    queryKey: llmSettingsKeys.all,
    queryFn: fetchLlmSettings,
    staleTime: 30_000,
  })
