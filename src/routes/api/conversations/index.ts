import { createFileRoute } from '@tanstack/react-router'
import { desc, eq } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversations } from '@/server/db/schema'
import {
  getCachedConversationTitles,
  setCachedConversationTitles,
  invalidateOnConversationCreate,
  type ConversationTitle,
} from '@/server/cache'
import { requireAuth } from '@/server/auth/get-session'

export const Route = createFileRoute('/api/conversations/')({
  server: {
    handlers: {
      // GET /api/conversations - List conversation titles (cache-first)
      GET: async ({ request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        const url = new URL(request.url)
        const starred = url.searchParams.get('starred')
        const fullData = url.searchParams.get('full') === 'true'

        try {
          // For starred filter or full data request, skip cache
          if (starred === 'true' || fullData) {
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
          }

          // Cache-first for sidebar titles
          const cached = await getCachedConversationTitles()
          if (cached) {
            return Response.json(cached)
          }

          // Cache miss: fetch from Turso (only id, title, lastMessageAt)
          const result = await db
            .select({
              id: conversations.id,
              title: conversations.title,
              lastMessageAt: conversations.lastMessageAt,
            })
            .from(conversations)
            .orderBy(
              desc(conversations.lastMessageAt),
              desc(conversations.createdAt),
            )

          // Transform to cache format
          const titles: ConversationTitle[] = result.map((c) => ({
            id: c.id,
            title: c.title,
            lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
          }))

          // Cache the result
          await setCachedConversationTitles(titles)

          return Response.json(titles)
        } catch (error) {
          console.error('Failed to fetch conversations:', error)
          return new Response('Failed to fetch conversations', { status: 500 })
        }
      },

      // POST /api/conversations - Create a new conversation
      POST: async ({ request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

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

          // Invalidate cache
          await invalidateOnConversationCreate()

          return Response.json(newConversation, { status: 201 })
        } catch (error) {
          console.error('Failed to create conversation:', error)
          return new Response('Failed to create conversation', { status: 500 })
        }
      },
    },
  },
})
