import { gateway } from '@ai-sdk/gateway'
import { createFileRoute } from '@tanstack/react-router'
import { convertToModelMessages, streamText } from 'ai'
import type { UIMessage } from 'ai'
import { requireAuth } from '@/server/auth/get-session'

type RegenerationPayload = {
  mode?: 'try-again' | 'expand' | 'concise' | 'instruction' | 'switch-model'
  instruction?: string
  assistantText?: string
}

const getMessageText = (message: UIMessage): string => {
  const msg = message as any
  if (typeof msg.content === 'string' && msg.content.length > 0) {
    return msg.content
  }
  if (message.parts.length > 0) {
    return message.parts
      .filter(
        (part): part is { type: 'text'; text: string } => part.type === 'text',
      )
      .map((part) => part.text)
      .join('')
  }
  return ''
}

const getAssistantMessageText = (
  messages: Array<UIMessage>,
  messageId?: string,
): string => {
  if (!messageId) return ''
  const target = messages.find(
    (message) => message.id === messageId && message.role === 'assistant',
  )
  if (!target) return ''
  return getMessageText(target)
}

const buildRegenerationPrompt = (
  payload: RegenerationPayload | undefined,
  messages: Array<UIMessage>,
  messageId?: string,
): string | undefined => {
  if (!payload) return undefined

  const instruction = payload.instruction?.trim()
  const assistantText =
    payload.assistantText?.trim() || getAssistantMessageText(messages, messageId)

  if (payload.mode === 'instruction') {
    return instruction || undefined
  }

  if (payload.mode === 'expand') {
    return [
      'You are revising the assistant response to the last user message.',
      'Expand it with more detail and specificity while keeping the same meaning and tone. Return only the revised response.',
      assistantText ? `Original response:\n${assistantText}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  if (payload.mode === 'concise') {
    return [
      'You are revising the assistant response to the last user message.',
      'Make it more concise while preserving the key details and tone. Return only the revised response.',
      assistantText ? `Original response:\n${assistantText}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  return instruction || undefined
}

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        if (!process.env.AI_GATEWAY_API_KEY) {
          return new Response('Missing AI_GATEWAY_API_KEY', { status: 500 })
        }

        const {
          messages,
          modelId,
          messageId,
          trigger,
          regeneration,
        }: {
          messages: Array<UIMessage>
          modelId?: string
          messageId?: string
          trigger?: string
          regeneration?: RegenerationPayload
        } = await request.json()

        const model = modelId ?? process.env.AI_MODEL ?? 'google/gemini-3-flash'
        console.log('model: ', model)

        const regenerationPrompt = buildRegenerationPrompt(
          regeneration,
          messages,
          messageId,
        )
        const chatMessages = regenerationPrompt
          ? ([
              {
                id: `system-${crypto.randomUUID()}`,
                role: 'system',
                parts: [{ type: 'text', text: regenerationPrompt }],
              } satisfies UIMessage,
              ...messages,
            ] as Array<UIMessage>)
          : messages
        const modelMessages = chatMessages.map(({ id, ...rest }) => rest)

        const result = streamText({
          model: gateway(model),
          messages: convertToModelMessages(modelMessages),
          providerOptions: {
            google: {
              thinkingConfig: {
                thinkingLevel: 'high',
                includeThoughts: true,
              }
            },
            anthropic: {
              thinking: { type: 'enabled', budgetTokens: 12000 },
            }
          }
        })

        // Return stream with usage data included in message metadata
        return result.toUIMessageStreamResponse({
          sendReasoning: true,
          generateMessageId:
            trigger === 'regenerate-message' && messageId
              ? () => messageId
              : undefined,
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

              // console.log('Sending message metadata:', metadata)
              return metadata
            }
            return undefined
          },
        })
      },
    },
  },
})
