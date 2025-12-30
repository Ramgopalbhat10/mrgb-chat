import { createFileRoute } from '@tanstack/react-router'
import { getCacheVersion } from '@/server/cache'
import { getSession } from '@/server/auth/get-session'

export const Route = createFileRoute('/api/cache-version')({
  server: {
    handlers: {
      // GET /api/cache-version - Get current cache version for ETag-like validation
      // Clients can poll this endpoint to detect server-side changes
      // and trigger a re-sync when the version changes
      GET: async ({ request }) => {
        const session = await getSession(request)
        if (!session) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          const version = await getCacheVersion()
          
          return new Response(
            JSON.stringify({ version }),
            { 
              headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              } 
            }
          )
        } catch (error) {
          console.error('Failed to get cache version:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to get cache version' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      },
    },
  },
})
