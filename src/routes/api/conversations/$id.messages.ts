import { createFileRoute } from '@tanstack/react-router'
import { and, asc, eq, gt } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversations, messages, sharedMessages } from '@/server/db/schema'
import {
  getCachedMessagePreview,
  setCachedMessagePreview,
  invalidateOnNewMessage,
  type MessagePreview,
} from '@/server/cache'
import { requireAuth } from '@/server/auth/get-session'

const PAGE_SIZE = 5 // Smaller page size for efficient pagination

export const Route = createFileRoute('/api/conversations/$id/messages')({
  server: {
    handlers: {
      // GET /api/conversations/:id/messages - Get messages (cache-first for preview)
      GET: async ({ params, request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        const url = new URL(request.url)
        const cursor = url.searchParams.get('cursor')
        const previewOnly = url.searchParams.get('preview') === 'true'

        try {
          // For initial load without cursor, try cache first (preview: first user + assistant)
          if (!cursor && previewOnly) {
            const cached = await getCachedMessagePreview(params.id)
            if (cached) {
              const previewMessages = []
              if (cached.userMessage) {
                previewMessages.push({
                  id: cached.userMessage.id,
                  conversationId: params.id,
                  role: 'user',
                  content: cached.userMessage.content,
                  createdAt: new Date(cached.userMessage.createdAt),
                  clientId: null,
                  metaJson: null,
                })
              }
              if (cached.assistantMessage) {
                previewMessages.push({
                  id: cached.assistantMessage.id,
                  conversationId: params.id,
                  role: 'assistant',
                  content: cached.assistantMessage.content,
                  createdAt: new Date(cached.assistantMessage.createdAt),
                  clientId: null,
                  metaJson: null,
                })
              }
              // Return preview with cursor for loading more
              const lastMsg = previewMessages[previewMessages.length - 1]
              return Response.json({
                messages: previewMessages,
                nextCursor: lastMsg?.createdAt?.toISOString(),
                fromCache: true,
              })
            }
          }

          // Paginated fetch from Turso
          const result = cursor
            ? await db
                .select()
                .from(messages)
                .where(
                  and(
                    eq(messages.conversationId, params.id),
                    gt(messages.createdAt, new Date(cursor)),
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

          // Cache the preview (first user + assistant message) if this is initial load
          if (!cursor && messageList.length > 0) {
            const userMsg = messageList.find((m) => m.role === 'user')
            const assistantMsg = messageList.find((m) => m.role === 'assistant')

            const preview: MessagePreview = {
              userMessage: userMsg
                ? {
                    id: userMsg.id,
                    content: userMsg.content,
                    createdAt: userMsg.createdAt.toISOString(),
                  }
                : null,
              assistantMessage: assistantMsg
                ? {
                    id: assistantMsg.id,
                    content: assistantMsg.content,
                    createdAt: assistantMsg.createdAt.toISOString(),
                  }
                : null,
            }

            // Cache in background (non-blocking)
            setCachedMessagePreview(params.id, preview).catch(console.error)
          }

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
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

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
            // metaJson is already a JSON string from client, don't double-stringify
            metaJson: typeof body.metaJson === 'string' ? body.metaJson : (body.metaJson ? JSON.stringify(body.metaJson) : null),
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

          // Invalidate cache (titles list and message preview)
          await invalidateOnNewMessage(params.id)

          return Response.json(newMessage, { status: 201 })
        } catch (error) {
          console.error('Failed to create message:', error)
          return new Response('Failed to create message', { status: 500 })
        }
      },

      // PATCH /api/conversations/:id/messages - Update a specific message content
      PATCH: async ({ params, request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        try {
          const url = new URL(request.url)
          const messageId = url.searchParams.get('messageId')
          const body = await request.json()

          if (!messageId) {
            return new Response('messageId query param required', { status: 400 })
          }

          if (!body.content) {
            return new Response('content is required', { status: 400 })
          }

          const updates: Partial<typeof messages.$inferInsert> = {
            content: body.content,
          }

          if (body.metaJson !== undefined) {
            updates.metaJson = body.metaJson
          }

          // Update the message content
          await db
            .update(messages)
            .set(updates)
            .where(
              and(
                eq(messages.id, messageId),
                eq(messages.conversationId, params.id),
              ),
            )

          // Invalidate cache
          await invalidateOnNewMessage(params.id)

          return new Response(null, { status: 204 })
        } catch (error) {
          console.error('Failed to update message:', error)
          return new Response('Failed to update message', { status: 500 })
        }
      },

      // DELETE /api/conversations/:id/messages - Delete a specific message
      DELETE: async ({ params, request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        try {
          const url = new URL(request.url)
          const messageId = url.searchParams.get('messageId')

          if (!messageId) {
            return new Response('messageId query param required', { status: 400 })
          }

          // First delete any shared message linked to this message
          await db
            .delete(sharedMessages)
            .where(eq(sharedMessages.originalMessageId, messageId))

          // Then delete the message itself
          await db
            .delete(messages)
            .where(
              and(
                eq(messages.id, messageId),
                eq(messages.conversationId, params.id),
              ),
            )

          return new Response(null, { status: 204 })
        } catch (error) {
          console.error('Failed to delete message:', error)
          return new Response('Failed to delete message', { status: 500 })
        }
      },
    },
  },
})
