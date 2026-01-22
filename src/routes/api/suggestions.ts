import { groq } from '@ai-sdk/groq'
import { createFileRoute } from '@tanstack/react-router'
import { generateObject, jsonSchema } from 'ai'
import { requireAuth } from '@/server/auth/get-session'

const stripCodeBlocks = (input: string) =>
  input
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`]*`/g, '')

const isCodeLikeLine = (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return false

  const symbolMatches = trimmed.match(/[^A-Za-z0-9\s]/g) ?? []
  const letterMatches = trimmed.match(/[A-Za-z0-9]/g) ?? []
  const symbolCount = symbolMatches.length
  const letterCount = letterMatches.length
  const symbolRatio = symbolCount / Math.max(trimmed.length, 1)

  if (letterCount === 0 && symbolCount >= 3) return true
  if (symbolRatio > 0.45 && symbolCount >= 4) return true

  if (
    /^(const|let|var|function|class|import|export|if|for|while|return|def|public|private|package|select|insert|update|delete)\b/i.test(
      trimmed,
    )
  ) {
    return true
  }

  if (/(=>|;|\{|\}|\(|\)|<[^>]+>)/.test(trimmed) && symbolRatio > 0.2) {
    return true
  }

  return false
}

const extractPlainText = (input: string) => {
  if (!input) return ''
  const withoutCode = stripCodeBlocks(input)
  const lines = withoutCode.split('\n')
  const filtered = lines.filter((line) => !isCodeLikeLine(line))
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const suggestionsSchema = jsonSchema<{ suggestions: string[] }>({
  type: 'object',
  additionalProperties: false,
  properties: {
    suggestions: {
      type: 'array',
      items: { type: 'string' },
      minItems: 5,
      maxItems: 5,
    },
  },
  required: ['suggestions'],
})

const normalizeSuggestions = (value: unknown) => {
  if (!Array.isArray(value)) return []
  const cleaned = value
    .map((item: unknown) => (typeof item === 'string' ? item : ''))
    .map((item: string) => stripCodeBlocks(item))
    .map((item: string) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const unique = Array.from(new Set(cleaned))
  const next = unique.length >= 5 ? unique : cleaned
  return next.slice(0, 5)
}

export const Route = createFileRoute('/api/suggestions')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        if (!process.env.AI_GATEWAY_API_KEY) {
          return new Response('Missing AI_GATEWAY_API_KEY', { status: 500 })
        }

        const {
          userMessage,
          assistantMessage,
        }: { userMessage: string; assistantMessage: string } =
          await request.json()

        if (!userMessage || !assistantMessage) {
          return new Response('Missing userMessage or assistantMessage', {
            status: 400,
          })
        }

        const model =
          process.env.AI_SUGGESTIONS_MODEL ??
          process.env.AI_TITLE_MODEL ??
          'openai/gpt-oss-20b'

        const cleanUser = extractPlainText(userMessage)
        const cleanAssistant = extractPlainText(assistantMessage)

        if (!cleanUser || !cleanAssistant) {
          return Response.json(
            { suggestions: [] },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        }

        try {
          const result = await generateObject({
            model: groq(model),
            schema: suggestionsSchema,
            schemaName: 'ConversationSuggestions',
            schemaDescription:
              'Five short follow-up prompts a user might ask next.',
            system:
              'You generate follow-up suggestions to continue a conversation. Use only natural-language context; ignore code blocks, inline code, ASCII art, and code-like fragments. Return exactly five short suggestions. No numbering, no quotes, no markdown, no code.',
            prompt: [
              'User message:',
              cleanUser,
              '',
              'Assistant response (text only):',
              cleanAssistant,
              '',
              'Generate 5 suggestions that the user might ask next.',
            ].join('\n'),
          })

          const suggestions = normalizeSuggestions(result.object?.suggestions)

          return Response.json(
            { suggestions },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        } catch (error) {
          console.error('Suggestion generation failed:', error)
          return Response.json(
            { suggestions: [] },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        }
      },
    },
  },
})
