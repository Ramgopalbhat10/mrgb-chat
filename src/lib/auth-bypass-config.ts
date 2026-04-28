export const AUTH_BYPASS_ENABLED =
  typeof process !== 'undefined' && process.env.AUTH_BYPASS === 'true'

const AUTH_BYPASS_USER_ID = 'auth-bypass-user'
const AUTH_BYPASS_SESSION_ID = 'auth-bypass-session'
const AUTH_BYPASS_SESSION_TOKEN = 'auth-bypass-token'
const AUTH_BYPASS_USER_EMAIL = 'local@example.com'
const AUTH_BYPASS_USER_NAME = 'Local Dev'

export function createAuthBypassSession() {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30)

  return {
    session: {
      id: AUTH_BYPASS_SESSION_ID,
      createdAt: now,
      updatedAt: now,
      userId: AUTH_BYPASS_USER_ID,
      expiresAt,
      token: AUTH_BYPASS_SESSION_TOKEN,
      ipAddress: null,
      userAgent: 'auth-bypass',
    },
    user: {
      id: AUTH_BYPASS_USER_ID,
      createdAt: now,
      updatedAt: now,
      email: AUTH_BYPASS_USER_EMAIL,
      emailVerified: true,
      name: AUTH_BYPASS_USER_NAME,
      image: null,
    },
  }
}
