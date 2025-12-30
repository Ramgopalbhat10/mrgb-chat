import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversations, messages, sharedMessages } from '@/server/db/schema'
import {
  invalidateOnConversationUpdate,
  invalidateOnConversationDelete,
  incrementCacheVersion,
} from '@/server/cache'
import { requireAuth } from '@/server/auth/get-session'

export const Route = createFileRoute('/api/conversations/$id')({
  server: {
    handlers: {
      // GET /api/conversations/:id - Get a single conversation
      GET: async ({ params, request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

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
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        try {
          const body = await request.json()
          const updates: Record<string, unknown> = {
            updatedAt: new Date(),
          }

          if (body.title !== undefined) updates.title = body.title
          if (body.starred !== undefined) updates.starred = body.starred
          if (body.isPublic !== undefined) updates.isPublic = body.isPublic
          if (body.lastMessageAt !== undefined)
            updates.lastMessageAt = body.lastMessageAt

          await db
            .update(conversations)
            .set(updates)
            .where(eq(conversations.id, params.id))

          // Invalidate cache and increment version for cross-device sync
          await invalidateOnConversationUpdate(params.id)
          await incrementCacheVersion()

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
      DELETE: async ({ params, request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        try {
          // Delete shared messages associated with this conversation
          await db
            .delete(sharedMessages)
            .where(eq(sharedMessages.conversationId, params.id))
          
          // Delete messages (also has cascade, but explicit is clearer)
          await db
            .delete(messages)
            .where(eq(messages.conversationId, params.id))
          
          // Delete the conversation
          await db.delete(conversations).where(eq(conversations.id, params.id))

          // Invalidate all related caches and increment version for cross-device sync
          await invalidateOnConversationDelete(params.id)
          await incrementCacheVersion()

          return new Response(null, { status: 204 })
        } catch (error) {
          console.error('Failed to delete conversation:', error)
          return new Response('Failed to delete conversation', { status: 500 })
        }
      },
    },
  },
})
