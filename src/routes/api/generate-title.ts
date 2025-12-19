import { groq } from '@ai-sdk/groq'
import { createFileRoute } from '@tanstack/react-router'
import { generateText } from 'ai'
import { eq } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversations } from '@/server/db/schema'

export const Route = createFileRoute('/api/generate-title')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.AI_GATEWAY_API_KEY) {
          return new Response('Missing AI_GATEWAY_API_KEY', { status: 500 })
        }

        const {
          userMessage,
          conversationId,
        }: { userMessage: string; conversationId: string } =
          await request.json()

        if (!userMessage || !conversationId) {
          return new Response('Missing userMessage or conversationId', {
            status: 400,
          })
        }

        const model = process.env.AI_TITLE_MODEL ?? 'openai/gpt-oss-20b'

        try {
          const result = await generateText({
            model: groq(model),
            system: `You are a title generator. Generate a short, concise title (max 6 words) for a conversation based on the user's first message. The title should capture the main topic or intent. Do not use quotes or punctuation at the end. Just output the title, nothing else.`,
            prompt: userMessage,
          })

          const title = result.text.trim()

          // Persist title to database
          try {
            await db
              .update(conversations)
              .set({ title, updatedAt: new Date() })
              .where(eq(conversations.id, conversationId))
          } catch (dbError) {
            console.error('Failed to persist title to database:', dbError)
            // Continue even if DB update fails - IndexedDB will have the title
          }

          return Response.json({
            title,
            conversationId,
          })
        } catch (error) {
          console.error('Title generation failed:', error)
          // Return a fallback title on error
          return Response.json({
            title: 'New conversation',
            conversationId,
          })
        }
      },
    },
  },
})
