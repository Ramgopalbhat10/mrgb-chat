import { createFileRoute } from '@tanstack/react-router'
import { desc } from 'drizzle-orm'

import { db } from '@/server/db'
import { projects } from '@/server/db/schema'

export const Route = createFileRoute('/api/projects/')({
  server: {
    handlers: {
      // GET /api/projects - List all projects
      GET: async () => {
        try {
          const result = await db
            .select()
            .from(projects)
            .orderBy(desc(projects.updatedAt))

          return Response.json(result)
        } catch (error) {
          console.error('Failed to fetch projects:', error)
          return new Response('Failed to fetch projects', { status: 500 })
        }
      },

      // POST /api/projects - Create a new project
      POST: async ({ request }) => {
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

          return Response.json(newProject, { status: 201 })
        } catch (error) {
          console.error('Failed to create project:', error)
          return new Response('Failed to create project', { status: 500 })
        }
      },
    },
  },
})
