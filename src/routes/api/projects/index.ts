import { createFileRoute } from '@tanstack/react-router'
import { desc, eq, sql } from 'drizzle-orm'

import { db } from '@/server/db'
import { projects, conversationProjects } from '@/server/db/schema'
import { getSession } from '@/server/auth/get-session'
import { 
  getCachedProjects, 
  setCachedProjects, 
  invalidateOnProjectChange,
  incrementCacheVersion,
  type CachedProject,
} from '@/server/cache'

export const Route = createFileRoute('/api/projects/')({
  server: {
    handlers: {
      // GET /api/projects - List all projects with conversation counts
      GET: async ({ request }) => {
        const session = await getSession(request)
        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          // Try Redis cache first
          const cached = await getCachedProjects()
          if (cached) {
            return Response.json(cached)
          }

          // Get projects with conversation counts using a subquery
          const result = await db
            .select({
              id: projects.id,
              name: projects.name,
              createdAt: projects.createdAt,
              updatedAt: projects.updatedAt,
              conversationCount: sql<number>`(
                SELECT COUNT(*) FROM ${conversationProjects} 
                WHERE ${conversationProjects.projectId} = ${projects.id}
              )`.as('conversationCount'),
            })
            .from(projects)
            .orderBy(desc(projects.updatedAt))

          // Transform for cache (dates to ISO strings)
          const cacheData: CachedProject[] = result.map((p) => ({
            id: p.id,
            name: p.name,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
            conversationCount: Number(p.conversationCount),
          }))

          // Cache the result
          await setCachedProjects(cacheData)

          return Response.json(cacheData)
        } catch (error) {
          console.error('Failed to fetch projects:', error)
          return new Response('Failed to fetch projects', { status: 500 })
        }
      },

      // POST /api/projects - Create a new project
      POST: async ({ request }) => {
        const session = await getSession(request)
        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const body = await request.json()
          const id = body.id ?? crypto.randomUUID()
          const now = new Date()

          const newProject = {
            id,
            name: body.name,
            createdAt: now,
            updatedAt: now,
          }

          await db.insert(projects).values(newProject)

          // Invalidate cache and increment version
          await invalidateOnProjectChange()
          await incrementCacheVersion()

          return Response.json(newProject, { status: 201 })
        } catch (error) {
          console.error('Failed to create project:', error)
          return new Response('Failed to create project', { status: 500 })
        }
      },

      // DELETE /api/projects - Delete a project
      DELETE: async ({ request }) => {
        const session = await getSession(request)
        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const projectId = url.searchParams.get('id')

          if (!projectId) {
            return new Response('Project ID required', { status: 400 })
          }

          // Delete project (conversation_projects will cascade)
          await db.delete(projects).where(eq(projects.id, projectId))

          // Invalidate cache and increment version
          await invalidateOnProjectChange()
          await incrementCacheVersion()

          return new Response(null, { status: 204 })
        } catch (error) {
          console.error('Failed to delete project:', error)
          return new Response('Failed to delete project', { status: 500 })
        }
      },
    },
  },
})
