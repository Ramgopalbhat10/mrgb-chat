import { createFileRoute } from '@tanstack/react-router'
import { and, asc, eq, lt } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversations, messages } from '@/server/db/schema'
// Note: conversations is still needed for the UPDATE in lastMessageAt

const PAGE_SIZE = 50

export const Route = createFileRoute('/api/conversations/$id/messages')({
  server: {
    handlers: {
      // GET /api/conversations/:id/messages - Get paginated messages
      GET: async ({ params, request }) => {
        const url = new URL(request.url)
        const cursor = url.searchParams.get('cursor')

        try {
          const result = cursor
            ? await db
                .select()
                .from(messages)
                .where(
                  and(
                    eq(messages.conversationId, params.id),
                    lt(messages.createdAt, new Date(cursor)),
                  ),
                )
                .orderBy(asc(messages.createdAt))
                .limit(PAGE_SIZE + 1)
            : await db
                .select()
                .from(messages)
                .where(eq(messages.conversationId, params.id))
                .orderBy(asc(messages.createdAt))
                .limit(PAGE_SIZE + 1)

          // Check if there are more messages
          const hasMore = result.length > PAGE_SIZE
          const messageList = hasMore ? result.slice(0, PAGE_SIZE) : result
          const nextCursor = hasMore
            ? messageList[messageList.length - 1]?.createdAt?.toISOString()
            : undefined

          return Response.json({
            messages: messageList,
            nextCursor,
          })
        } catch (error) {
          console.error('Failed to fetch messages:', error)
          return new Response('Failed to fetch messages', { status: 500 })
        }
      },

      // POST /api/conversations/:id/messages - Create a new message
      POST: async ({ params, request }) => {
        try {
          const body = await request.json()
          const id = body.id ?? crypto.randomUUID()
          const now = new Date()

          const newMessage = {
            id,
            conversationId: params.id,
            role: body.role as 'user' | 'assistant' | 'system' | 'tool',
            content: body.content,
            clientId: body.clientId ?? null,
            metaJson: body.metaJson ? JSON.stringify(body.metaJson) : null,
            createdAt: now,
          }

          await db.insert(messages).values(newMessage)

          // Update conversation's lastMessageAt
          await db
            .update(conversations)
            .set({
              lastMessageAt: now,
              updatedAt: now,
            })
            .where(eq(conversations.id, params.id))

          return Response.json(newMessage, { status: 201 })
        } catch (error) {
          console.error('Failed to create message:', error)
          return new Response('Failed to create message', { status: 500 })
        }
      },
    },
  },
})
