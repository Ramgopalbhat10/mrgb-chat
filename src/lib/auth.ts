import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { AUTH_BYPASS_ENABLED } from './auth-bypass-config'
import { db } from '@/server/db/drizzle'
import * as schema from '@/server/db/schema'

function createConfiguredAuth() {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      },
    },
  })
}

export const auth = AUTH_BYPASS_ENABLED ? null : createConfiguredAuth()
