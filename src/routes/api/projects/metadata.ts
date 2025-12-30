import { createFileRoute } from '@tanstack/react-router'
import { desc, sql } from 'drizzle-orm'

import { db } from '@/server/db'
import { projects, conversationProjects } from '@/server/db/schema'
import { getSession } from '@/server/auth/get-session'
import { redis, cacheKeys, CACHE_TTL } from '@/server/cache'

interface ProjectMetadata {
  projects: Array<{
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
    conversationCount: number
  }>
  conversationProjects: Record<string, string[]> // conversationId -> projectIds[]
}

export const Route = createFileRoute('/api/projects/metadata')({
  server: {
    handlers: {
      // GET /api/projects/metadata - Get all projects with conversation mappings (cached)
      GET: async ({ request }) => {
        const session = await getSession(request)
        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          // Try to get from cache first
          if (redis) {
            const cached = await redis.get<ProjectMetadata>(cacheKeys.projectMetadata())
            if (cached) {
              return Response.json(cached)
            }
          }

          // Fetch all projects with conversation counts
          const projectsList = await db
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

          // Fetch all conversation-project mappings in one query
          const allMappings = await db
            .select({
              conversationId: conversationProjects.conversationId,
              projectId: conversationProjects.projectId,
            })
            .from(conversationProjects)

          // Build the conversationProjects map
          const convProjectsMap: Record<string, string[]> = {}
          allMappings.forEach(({ conversationId, projectId }) => {
            if (!convProjectsMap[conversationId]) {
              convProjectsMap[conversationId] = []
            }
            convProjectsMap[conversationId].push(projectId)
          })

          const metadata: ProjectMetadata = {
            projects: projectsList,
            conversationProjects: convProjectsMap,
          }

          // Cache the result
          if (redis) {
            await redis.set(cacheKeys.projectMetadata(), metadata, {
              ex: CACHE_TTL.PROJECT_LIST,
            })
          }

          return Response.json(metadata)
        } catch (error) {
          console.error('Failed to fetch projects metadata:', error)
          return new Response('Failed to fetch projects metadata', { status: 500 })
        }
      },
    },
  },
})
