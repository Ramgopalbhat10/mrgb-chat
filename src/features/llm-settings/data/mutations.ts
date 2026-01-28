import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LlmSettings } from '@/lib/llm-settings'
import { llmSettingsKeys } from './queries'

async function updateLlmSettings(
  updates: Partial<LlmSettings>,
): Promise<LlmSettings> {
  const response = await fetch('/api/llm-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    throw new Error('Failed to update LLM settings')
  }

  return response.json()
}

export function useUpdateLlmSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateLlmSettings,
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: llmSettingsKeys.all })
      const previous = queryClient.getQueryData<LlmSettings>(
        llmSettingsKeys.all,
      )
      queryClient.setQueryData<LlmSettings>(llmSettingsKeys.all, (current) => ({
        ...(current ?? {}),
        ...updates,
      }))
      return { previous }
    },
    onError: (_error, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData<LlmSettings>(
          llmSettingsKeys.all,
          context.previous,
        )
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<LlmSettings>(llmSettingsKeys.all, data)
    },
  })
}
