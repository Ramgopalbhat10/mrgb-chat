import { createFileRoute } from '@tanstack/react-router'
import { eq, and } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversationProjects, projects } from '@/server/db/schema'
import { getSession } from '@/server/auth/get-session'
import { invalidateProjectsMetadata } from '@/server/cache/redis'

export const Route = createFileRoute('/api/projects/$id/conversations')({
  server: {
    handlers: {
      // GET /api/projects/:id/conversations - Get conversations in a project
      GET: async ({ params, request }) => {
        const session = await getSession(request)
        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const result = await db
            .select({
              conversationId: conversationProjects.conversationId,
            })
            .from(conversationProjects)
            .where(eq(conversationProjects.projectId, params.id))

          return Response.json(result.map((r) => r.conversationId))
        } catch (error) {
          console.error('Failed to fetch project conversations:', error)
          return new Response('Failed to fetch project conversations', {
            status: 500,
          })
        }
      },

      // POST /api/projects/:id/conversations - Add conversation to project
      POST: async ({ params, request }) => {
        const session = await getSession(request)
        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const body = await request.json()
          const { conversationId } = body

          if (!conversationId) {
            return new Response('conversationId required', { status: 400 })
          }

          // Check if already exists
          const existing = await db
            .select()
            .from(conversationProjects)
            .where(
              and(
                eq(conversationProjects.projectId, params.id),
                eq(conversationProjects.conversationId, conversationId),
              ),
            )

          if (existing.length > 0) {
            return Response.json({ message: 'Already in project' })
          }

          await db.insert(conversationProjects).values({
            projectId: params.id,
            conversationId,
          })

          // Update project's updatedAt
          await db
            .update(projects)
            .set({ updatedAt: new Date() })
            .where(eq(projects.id, params.id))

          // Invalidate cache
          await invalidateProjectsMetadata()

          return Response.json({ success: true }, { status: 201 })
        } catch (error) {
          console.error('Failed to add conversation to project:', error)
          return new Response('Failed to add conversation to project', {
            status: 500,
          })
        }
      },

      // DELETE /api/projects/:id/conversations - Remove conversation from project
      DELETE: async ({ params, request }) => {
        const session = await getSession(request)
        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const conversationId = url.searchParams.get('conversationId')

          if (!conversationId) {
            return new Response('conversationId required', { status: 400 })
          }

          await db
            .delete(conversationProjects)
            .where(
              and(
                eq(conversationProjects.projectId, params.id),
                eq(conversationProjects.conversationId, conversationId),
              ),
            )

          // Invalidate cache
          await invalidateProjectsMetadata()

          return new Response(null, { status: 204 })
        } catch (error) {
          console.error('Failed to remove conversation from project:', error)
          return new Response('Failed to remove conversation from project', {
            status: 500,
          })
        }
      },
    },
  },
})
