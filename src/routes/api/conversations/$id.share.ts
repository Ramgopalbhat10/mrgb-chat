import { createFileRoute } from '@tanstack/react-router'
import { eq, and, asc } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversations, messages } from '@/server/db/schema'

export const Route = createFileRoute('/api/conversations/$id/share')({
  server: {
    handlers: {
      // GET /api/conversations/:id/share - Get shared conversation (no auth required)
      GET: async ({ params }) => {
        try {
          // First check if conversation exists and is public
          const result = await db
            .select()
            .from(conversations)
            .where(
              and(
                eq(conversations.id, params.id),
                eq(conversations.isPublic, true)
              )
            )
            .limit(1)

          if (result.length === 0) {
            return new Response('Conversation not found or not shared', { status: 404 })
          }

          const conversation = result[0]

          // Get all messages for this conversation
          const conversationMessages = await db
            .select({
              id: messages.id,
              role: messages.role,
              content: messages.content,
              createdAt: messages.createdAt,
            })
            .from(messages)
            .where(eq(messages.conversationId, params.id))
            .orderBy(asc(messages.createdAt))

          return Response.json({
            conversation: {
              id: conversation.id,
              title: conversation.title,
              createdAt: conversation.createdAt,
            },
            messages: conversationMessages.filter(
              (m) => m.role === 'user' || m.role === 'assistant'
            ),
          })
        } catch (error) {
          console.error('Failed to fetch shared conversation:', error)
          return new Response('Failed to fetch conversation', { status: 500 })
        }
      },
    },
  },
})
