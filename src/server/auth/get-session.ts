import { auth } from '@/lib/auth'
import {
  AUTH_BYPASS_ENABLED,
  createAuthBypassSession,
} from '@/lib/auth-bypass-config'

/**
 * Get the current session from a request.
 * Returns null if not authenticated.
 */
export async function getSession(request: Request) {
  if (AUTH_BYPASS_ENABLED) {
    return createAuthBypassSession()
  }

  if (!auth) {
    return null
  }

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    return session
  } catch {
    return null
  }
}

/**
 * Require authentication for an API route.
 * Returns 401 Response if not authenticated, otherwise returns the session.
 */
export async function requireAuth(request: Request) {
  const session = await getSession(request)

  if (!session) {
    return {
      authorized: false as const,
      response: new Response('Unauthorized', { status: 401 }),
    }
  }

  return {
    authorized: true as const,
    session,
    user: session.user,
  }
}
