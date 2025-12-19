import { Redis } from '@upstash/redis'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

if (!url || !token) {
  console.warn('Upstash Redis environment variables not set. Caching disabled.')
}

export const redis = url && token ? new Redis({ url, token }) : null

export type RedisClient = typeof redis
