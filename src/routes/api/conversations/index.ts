import { createFileRoute } from '@tanstack/react-router'
import { and, desc, eq, gt, sql } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversations } from '@/server/db/schema'
import {
  getCachedConversationTitles,
  setCachedConversationTitles,
  invalidateOnConversationCreate,
  incrementCacheVersion,
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
        const sinceRevisionParam = url.searchParams.get('sinceRevision')
        const sinceRevision = sinceRevisionParam
          ? Number.parseInt(sinceRevisionParam, 10)
          : null
        const cursor = url.searchParams.get('cursor')
        const limit = Math.min(
          parseInt(url.searchParams.get('limit') ?? String(PAGE_SIZE), 10),
          100,
        )

        try {
          const sortTimestamp = sql`coalesce(${conversations.lastMessageAt}, ${conversations.createdAt})`

          // Build base conditions
          const conditions = []

          // Filter by archived status (default: non-archived)
          conditions.push(eq(conversations.archived, archived))

          // Filter by starred if specified
          if (starred === 'true') {
            conditions.push(eq(conversations.starred, true))
          }

          if (sinceRevision !== null && !Number.isNaN(sinceRevision)) {
            conditions.push(gt(conversations.revision, sinceRevision))
          }

          // Cursor-based pagination
          if (cursor) {
            conditions.push(sql`${sortTimestamp} < ${new Date(cursor)}`)
          }

          // For full data request, return all fields
          if (fullData) {
            const result = await db
              .select()
              .from(conversations)
              .where(and(...conditions))
              .orderBy(
                desc(sortTimestamp),
                desc(conversations.createdAt),
              )
              .limit(limit + 1)

            const hasMore = result.length > limit
            const items = hasMore ? result.slice(0, -1) : result
            const lastItem = items[items.length - 1]
            const nextCursor =
              hasMore && lastItem
                ? (lastItem.lastMessageAt ?? lastItem.createdAt)?.toISOString()
                : null

            const [{ latestRevision }] = await db
              .select({
                latestRevision: sql<number>`max(${conversations.revision})`,
              })
              .from(conversations)

            return Response.json({
              conversations: items,
              nextCursor,
              hasMore,
              latestRevision: latestRevision ?? 0,
            })
          }

          // Cache-first for first page of non-archived, non-starred titles
          if (!cursor && !archived && starred !== 'true' && sinceRevision === null) {
            const cached = await getCachedConversationTitles()
            if (cached && cached.length > 0) {
              // Return paginated cache result
              const items = cached.slice(0, limit)
              const hasMore = cached.length > limit
              const lastItem = items[items.length - 1]
              const nextCursor =
                hasMore && lastItem
                  ? lastItem.lastMessageAt ?? lastItem.createdAt ?? null
                  : null

              const [{ latestRevision }] = await db
                .select({
                  latestRevision: sql<number>`max(${conversations.revision})`,
                })
                .from(conversations)

              return Response.json({
                conversations: items,
                nextCursor,
                hasMore,
                latestRevision: latestRevision ?? 0,
              })
            }
          }

          // Fetch from Turso (only id, title, lastMessageAt, starred, archived, isPublic)
          const result = await db
            .select({
              id: conversations.id,
              title: conversations.title,
              createdAt: conversations.createdAt,
              lastMessageAt: conversations.lastMessageAt,
              starred: conversations.starred,
              archived: conversations.archived,
              isPublic: conversations.isPublic,
              revision: conversations.revision,
            })
            .from(conversations)
            .where(and(...conditions))
            .orderBy(
              desc(sortTimestamp),
              desc(conversations.createdAt),
            )
            .limit(limit + 1)

          const hasMore = result.length > limit
          const items = hasMore ? result.slice(0, -1) : result

          // Transform to response format
          const titles: ConversationTitle[] = items.map((c) => ({
            id: c.id,
            title: c.title,
            createdAt: c.createdAt.toISOString(),
            lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
            starred: c.starred,
            archived: c.archived,
            isPublic: c.isPublic,
            revision: c.revision,
          }))

          const lastItem = titles[titles.length - 1]
          const nextCursor =
            hasMore && lastItem
              ? lastItem.lastMessageAt ?? lastItem.createdAt ?? null
              : null

          // Cache first page of non-archived titles
          if (!cursor && !archived && starred !== 'true' && sinceRevision === null) {
            await setCachedConversationTitles(titles)
          }

          const [{ latestRevision }] = await db
            .select({
              latestRevision: sql<number>`max(${conversations.revision})`,
            })
            .from(conversations)

          return Response.json({
            conversations: titles,
            nextCursor,
            hasMore,
            latestRevision: latestRevision ?? 0,
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

          // Invalidate cache and increment version for cross-device sync
          await invalidateOnConversationCreate()
          await incrementCacheVersion()

          return Response.json(newConversation, { status: 201 })
        } catch (error) {
          console.error('Failed to create conversation:', error)
          return new Response('Failed to create conversation', { status: 500 })
        }
      },
    },
  },
})
