import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/server/auth/get-session'
import { getLlmSettings, setLlmSettings } from '@/server/llm-settings'

export const Route = createFileRoute('/api/llm-settings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        const settings = await getLlmSettings()
        return new Response(JSON.stringify(settings), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        })
      },
      PATCH: async ({ request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        const updates = await request.json().catch(() => ({}))
        const settings = await setLlmSettings(updates)
        return new Response(JSON.stringify(settings), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
