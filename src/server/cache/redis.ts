import { Redis } from '@upstash/redis'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

if (!url || !token) {
  console.warn('Upstash Redis environment variables not set. Caching disabled.')
}

export const redis = url && token ? new Redis({ url, token }) : null

export type RedisClient = typeof redis

// Cache keys
export const CACHE_KEYS = {
  PROJECTS_METADATA: 'projects:metadata',
  CONVERSATION_TITLES: 'conversations:titles',
} as const

// Cache TTL in seconds
export const CACHE_TTL = {
  PROJECTS_METADATA: 300, // 5 minutes
  CONVERSATION_TITLES: 120, // 2 minutes
} as const

// Helper to invalidate projects metadata cache
export async function invalidateProjectsMetadata() {
  if (redis) {
    await redis.del(CACHE_KEYS.PROJECTS_METADATA)
  }
}
