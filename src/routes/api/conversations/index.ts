import { createFileRoute } from '@tanstack/react-router'
import { and, desc, eq, lt } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversations } from '@/server/db/schema'
import {
  getCachedConversationTitles,
  setCachedConversationTitles,
  invalidateOnConversationCreate,
  type ConversationTitle,
} from '@/server/cache'
import { requireAuth } from '@/server/auth/get-session'

const PAGE_SIZE = 30

export const Route = createFileRoute('/api/conversations/')({
  server: {
    handlers: {
      // GET /api/conversations - List conversation titles with pagination
      GET: async ({ request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        const url = new URL(request.url)
        const starred = url.searchParams.get('starred')
        const archived = url.searchParams.get('archived') === 'true'
        const fullData = url.searchParams.get('full') === 'true'
        const cursor = url.searchParams.get('cursor')
        const limit = Math.min(
          parseInt(url.searchParams.get('limit') ?? String(PAGE_SIZE), 10),
          100,
        )

        try {
          // Build base conditions
          const conditions = []

          // Filter by archived status (default: non-archived)
          conditions.push(eq(conversations.archived, archived))

          // Filter by starred if specified
          if (starred === 'true') {
            conditions.push(eq(conversations.starred, true))
          }

          // Cursor-based pagination
          if (cursor) {
            conditions.push(lt(conversations.lastMessageAt, new Date(cursor)))
          }

          // For full data request, return all fields
          if (fullData) {
            const result = await db
              .select()
              .from(conversations)
              .where(and(...conditions))
              .orderBy(
                desc(conversations.lastMessageAt),
                desc(conversations.createdAt),
              )
              .limit(limit + 1)

            const hasMore = result.length > limit
            const items = hasMore ? result.slice(0, -1) : result
            const nextCursor =
              hasMore && items.length > 0
                ? items[items.length - 1].lastMessageAt?.toISOString()
                : null

            return Response.json({
              conversations: items,
              nextCursor,
              hasMore,
            })
          }

          // Cache-first for first page of non-archived, non-starred titles
          if (!cursor && !archived && starred !== 'true') {
            const cached = await getCachedConversationTitles()
            if (cached && cached.length > 0) {
              // Return paginated cache result
              const items = cached.slice(0, limit)
              const hasMore = cached.length > limit
              const nextCursor =
                hasMore && items.length > 0
                  ? items[items.length - 1].lastMessageAt
                  : null

              return Response.json({
                conversations: items,
                nextCursor,
                hasMore,
              })
            }
          }

          // Fetch from Turso (only id, title, lastMessageAt, starred, archived)
          const result = await db
            .select({
              id: conversations.id,
              title: conversations.title,
              lastMessageAt: conversations.lastMessageAt,
              starred: conversations.starred,
              archived: conversations.archived,
            })
            .from(conversations)
            .where(and(...conditions))
            .orderBy(
              desc(conversations.lastMessageAt),
              desc(conversations.createdAt),
            )
            .limit(limit + 1)

          const hasMore = result.length > limit
          const items = hasMore ? result.slice(0, -1) : result

          // Transform to response format
          const titles: ConversationTitle[] = items.map((c) => ({
            id: c.id,
            title: c.title,
            lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
            starred: c.starred,
            archived: c.archived,
          }))

          const nextCursor =
            hasMore && titles.length > 0
              ? titles[titles.length - 1].lastMessageAt
              : null

          // Cache first page of non-archived titles
          if (!cursor && !archived && starred !== 'true') {
            await setCachedConversationTitles(titles)
          }

          return Response.json({
            conversations: titles,
            nextCursor,
            hasMore,
          })
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
