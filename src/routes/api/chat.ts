import { createFileRoute } from '@tanstack/react-router'
import { gateway } from '@ai-sdk/gateway'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { requireAuth } from '@/server/auth/get-session'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        if (!process.env.AI_GATEWAY_API_KEY) {
          return new Response('Missing AI_GATEWAY_API_KEY', { status: 500 })
        }

        const { messages, data }: { messages: UIMessage[]; data?: { modelId?: string } } = await request.json()

        const model = data?.modelId ?? process.env.AI_MODEL ?? 'google/gemini-3-flash'

        const result = streamText({
          model: gateway(model),
          messages: convertToModelMessages(messages),
        })

        // Return stream with usage data included in message metadata
        return result.toUIMessageStreamResponse({
          messageMetadata: ({ part }) => {
            if (part.type === 'finish') {
              const finishPart = part as any
              
              // Include usage and cost data in message metadata
              // AI SDK v5 uses totalUsage instead of usage
              const usage = finishPart.totalUsage || finishPart.usage
              const metadata: Record<string, unknown> = {
                model,
                usage,
                finishReason: finishPart.finishReason,
              }
              
              // Include gateway cost if available (from response or providerMetadata)
              const providerMeta = finishPart.providerMetadata || finishPart.response?.providerMetadata
              if (providerMeta?.gateway) {
                metadata.gatewayCost = providerMeta.gateway.cost
                metadata.generationId = providerMeta.gateway.generationId
              }
              
              console.log('Sending message metadata:', metadata)
              return metadata
            }
            return undefined
          },
        })
      },
    },
  },
})
