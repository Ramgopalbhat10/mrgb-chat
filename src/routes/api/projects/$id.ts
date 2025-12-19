import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversationProjects, projects } from '@/server/db/schema'

export const Route = createFileRoute('/api/projects/$id')({
  server: {
    handlers: {
      // GET /api/projects/:id - Get a single project
      GET: async ({ params }) => {
        try {
          const result = await db
            .select()
            .from(projects)
            .where(eq(projects.id, params.id))
            .limit(1)

          if (result.length === 0) {
            return new Response('Project not found', { status: 404 })
          }

          return Response.json(result[0])
        } catch (error) {
          console.error('Failed to fetch project:', error)
          return new Response('Failed to fetch project', { status: 500 })
        }
      },

      // PATCH /api/projects/:id - Update a project
      PATCH: async ({ params, request }) => {
        try {
          const body = await request.json()
          const updates: Record<string, unknown> = {
            updatedAt: new Date(),
          }

          if (body.name !== undefined) updates.name = body.name

          await db
            .update(projects)
            .set(updates)
            .where(eq(projects.id, params.id))

          const result = await db
            .select()
            .from(projects)
            .where(eq(projects.id, params.id))
            .limit(1)

          if (result.length === 0) {
            return new Response('Project not found', { status: 404 })
          }

          return Response.json(result[0])
        } catch (error) {
          console.error('Failed to update project:', error)
          return new Response('Failed to update project', { status: 500 })
        }
      },

      // DELETE /api/projects/:id - Delete a project
      DELETE: async ({ params }) => {
        try {
          // Delete conversation associations first
          await db
            .delete(conversationProjects)
            .where(eq(conversationProjects.projectId, params.id))
          await db.delete(projects).where(eq(projects.id, params.id))

          return new Response(null, { status: 204 })
        } catch (error) {
          console.error('Failed to delete project:', error)
          return new Response('Failed to delete project', { status: 500 })
        }
      },
    },
  },
})
