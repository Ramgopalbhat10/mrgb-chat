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

        const { messages }: { messages: UIMessage[] } = await request.json()

        const model = process.env.AI_MODEL ?? 'google/gemini-3-flash'

        const result = streamText({
          model: gateway(model),
          messages: convertToModelMessages(messages),
        })

        return result.toUIMessageStreamResponse()
      },
    },
  },
})
