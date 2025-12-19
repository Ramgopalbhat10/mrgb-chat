import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversationProjects, projects } from '@/server/db/schema'

export const Route = createFileRoute('/api/projects/$id/add-conversation')({
  server: {
    handlers: {
      // POST /api/projects/:id/add-conversation - Add a conversation to a project
      POST: async ({ params, request }) => {
        try {
          const body = await request.json()
          const { conversationId } = body

          if (!conversationId) {
            return new Response('Missing conversationId', { status: 400 })
          }

          // Check if association already exists
          const existing = await db
            .select()
            .from(conversationProjects)
            .where(eq(conversationProjects.projectId, params.id))
            .limit(1)

          const alreadyExists = existing.some(
            (cp) => cp.conversationId === conversationId,
          )

          if (!alreadyExists) {
            await db.insert(conversationProjects).values({
              conversationId,
              projectId: params.id,
            })
          }

          // Update project's updatedAt
          await db
            .update(projects)
            .set({ updatedAt: new Date() })
            .where(eq(projects.id, params.id))

          return Response.json({ success: true })
        } catch (error) {
          console.error('Failed to add conversation to project:', error)
          return new Response('Failed to add conversation to project', {
            status: 500,
          })
        }
      },

      // DELETE /api/projects/:id/add-conversation - Remove a conversation from a project
      DELETE: async ({ params, request }) => {
        try {
          const body = await request.json()
          const { conversationId } = body

          if (!conversationId) {
            return new Response('Missing conversationId', { status: 400 })
          }

          await db
            .delete(conversationProjects)
            .where(eq(conversationProjects.projectId, params.id))

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
