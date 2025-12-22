import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversationProjects } from '@/server/db/schema'
import { getSession } from '@/server/auth/get-session'

export const Route = createFileRoute('/api/conversations/$id/projects')({
  server: {
    handlers: {
      // GET /api/conversations/:id/projects - Get all project IDs for a conversation
      GET: async ({ params, request }) => {
        const session = await getSession(request)
        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const result = await db
            .select({
              projectId: conversationProjects.projectId,
            })
            .from(conversationProjects)
            .where(eq(conversationProjects.conversationId, params.id))

          return Response.json(result.map((r) => r.projectId))
        } catch (error) {
          console.error('Failed to fetch conversation projects:', error)
          return new Response('Failed to fetch conversation projects', {
            status: 500,
          })
        }
      },
    },
  },
})
