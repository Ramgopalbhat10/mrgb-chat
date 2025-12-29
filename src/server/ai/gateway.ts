import { createServerFn } from '@tanstack/react-start'

export const getAvailableModels = createServerFn({ method: 'GET' }).handler(
  async () => {
    try {
      const apiKey = process.env.AI_GATEWAY_API_KEY
      if (!apiKey) {
        throw new Error('AI_GATEWAY_API_KEY is not configured')
      }

      const response = await fetch('https://ai-gateway.vercel.sh/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('AI Gateway API error:', response.status, errorText)
        throw new Error(`Failed to fetch models: ${response.status}`)
      }

      const data = await response.json()
      // The API returns a list under the 'data' property based on typical OpenAI-compatible responses
      return (data.data || data.models || []) as any
    } catch (error) {
      console.error('Failed to fetch available models from AI Gateway:', error)
      throw new Error('Failed to fetch models')
    }
  },
)
