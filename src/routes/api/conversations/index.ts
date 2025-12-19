import { createFileRoute } from '@tanstack/react-router'
import { desc, eq } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversations } from '@/server/db/schema'

export const Route = createFileRoute('/api/conversations/')({
  server: {
    handlers: {
      // GET /api/conversations - List all conversations
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const starred = url.searchParams.get('starred')

        try {
          const result =
            starred === 'true'
              ? await db
                  .select()
                  .from(conversations)
                  .where(eq(conversations.starred, true))
                  .orderBy(
                    desc(conversations.lastMessageAt),
                    desc(conversations.createdAt),
                  )
              : await db
                  .select()
                  .from(conversations)
                  .orderBy(
                    desc(conversations.lastMessageAt),
                    desc(conversations.createdAt),
                  )

          return Response.json(result)
        } catch (error) {
          console.error('Failed to fetch conversations:', error)
          return new Response('Failed to fetch conversations', { status: 500 })
        }
      },

      // POST /api/conversations - Create a new conversation
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const id = body.id ?? crypto.randomUUID()
          const now = new Date()

          // Parse date strings from JSON (client sends ISO strings)
          const lastMessageAt = body.lastMessageAt
            ? new Date(body.lastMessageAt)
            : null

          const newConversation = {
            id,
            title: body.title ?? 'New conversation',
            starred: body.starred ?? false,
            createdAt: now,
            updatedAt: now,
            lastMessageAt,
          }

          // Use onConflictDoNothing to handle race condition where /messages endpoint
          // might create the conversation first (both are fire-and-forget from client)
          await db
            .insert(conversations)
            .values(newConversation)
            .onConflictDoNothing({ target: conversations.id })

          return Response.json(newConversation, { status: 201 })
        } catch (error) {
          console.error('Failed to create conversation:', error)
          return new Response('Failed to create conversation', { status: 500 })
        }
      },
    },
  },
})
