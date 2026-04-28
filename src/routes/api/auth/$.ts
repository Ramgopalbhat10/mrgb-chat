import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'
import {
  AUTH_BYPASS_ENABLED,
  createAuthBypassSession,
} from '@/lib/auth-bypass-config'

function handleBypassedAuthRequest(request: Request): Response {
  const url = new URL(request.url)
  const authPath = url.pathname.slice('/api/auth'.length)

  if (authPath === '/get-session') {
    return Response.json(createAuthBypassSession())
  }

  if (authPath === '/sign-out') {
    return Response.json({ success: true })
  }

  return Response.redirect(new URL('/', request.url), 302)
}

function authNotConfiguredResponse(): Response {
  return Response.json(
    { error: 'Authentication is not configured' },
    { status: 500 },
  )
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (AUTH_BYPASS_ENABLED) {
          return handleBypassedAuthRequest(request)
        }
        if (!auth) {
          return authNotConfiguredResponse()
        }
        return auth.handler(request)
      },
      POST: async ({ request }) => {
        if (AUTH_BYPASS_ENABLED) {
          return handleBypassedAuthRequest(request)
        }
        if (!auth) {
          return authNotConfiguredResponse()
        }
        return auth.handler(request)
      },
    },
  },
})
