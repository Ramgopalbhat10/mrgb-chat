import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversations, messages } from '@/server/db/schema'

export const Route = createFileRoute('/api/conversations/$id')({
  server: {
    handlers: {
      // GET /api/conversations/:id - Get a single conversation
      GET: async ({ params }) => {
        try {
          const result = await db
            .select()
            .from(conversations)
            .where(eq(conversations.id, params.id))
            .limit(1)

          if (result.length === 0) {
            return new Response('Conversation not found', { status: 404 })
          }

          return Response.json(result[0])
        } catch (error) {
          console.error('Failed to fetch conversation:', error)
          return new Response('Failed to fetch conversation', { status: 500 })
        }
      },

      // PATCH /api/conversations/:id - Update a conversation
      PATCH: async ({ params, request }) => {
        try {
          const body = await request.json()
          const updates: Record<string, unknown> = {
            updatedAt: new Date(),
          }

          if (body.title !== undefined) updates.title = body.title
          if (body.starred !== undefined) updates.starred = body.starred
          if (body.lastMessageAt !== undefined)
            updates.lastMessageAt = body.lastMessageAt

          await db
            .update(conversations)
            .set(updates)
            .where(eq(conversations.id, params.id))

          const result = await db
            .select()
            .from(conversations)
            .where(eq(conversations.id, params.id))
            .limit(1)

          if (result.length === 0) {
            return new Response('Conversation not found', { status: 404 })
          }

          return Response.json(result[0])
        } catch (error) {
          console.error('Failed to update conversation:', error)
          return new Response('Failed to update conversation', { status: 500 })
        }
      },

      // DELETE /api/conversations/:id - Delete a conversation
      DELETE: async ({ params }) => {
        try {
          // Messages will be cascade deleted due to foreign key constraint
          await db
            .delete(messages)
            .where(eq(messages.conversationId, params.id))
          await db.delete(conversations).where(eq(conversations.id, params.id))

          return new Response(null, { status: 204 })
        } catch (error) {
          console.error('Failed to delete conversation:', error)
          return new Response('Failed to delete conversation', { status: 500 })
        }
      },
    },
  },
})
