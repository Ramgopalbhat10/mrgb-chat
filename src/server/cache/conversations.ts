import { redis } from './redis'
import { cacheKeys, CACHE_TTL, invalidationKeys } from './keys'

// Lightweight conversation title for sidebar
export interface ConversationTitle {
  id: string
  title: string
  lastMessageAt: string | null // ISO string
  starred?: boolean
  archived?: boolean
  isPublic?: boolean
}

// Message preview: first user message + assistant response
export interface MessagePreview {
  userMessage: {
    id: string
    content: string
    createdAt: string
  } | null
  assistantMessage: {
    id: string
    content: string
    createdAt: string
  } | null
}

// Get conversation titles from cache
export async function getCachedConversationTitles(): Promise<ConversationTitle[] | null> {
  if (!redis) return null

  try {
    const cached = await redis.get<ConversationTitle[]>(cacheKeys.conversationTitles())
    return cached
  } catch (error) {
    console.error('Redis get error (conversation titles):', error)
    return null
  }
}

// Set conversation titles in cache
export async function setCachedConversationTitles(
  titles: ConversationTitle[],
): Promise<void> {
  if (!redis) return

  try {
    await redis.set(cacheKeys.conversationTitles(), titles, {
      ex: CACHE_TTL.CONVERSATION_TITLES,
    })
  } catch (error) {
    console.error('Redis set error (conversation titles):', error)
  }
}

// Get message preview from cache
export async function getCachedMessagePreview(
  conversationId: string,
): Promise<MessagePreview | null> {
  if (!redis) return null

  try {
    const cached = await redis.get<MessagePreview>(
      cacheKeys.messagePreview(conversationId),
    )
    return cached
  } catch (error) {
    console.error('Redis get error (message preview):', error)
    return null
  }
}

// Set message preview in cache
export async function setCachedMessagePreview(
  conversationId: string,
  preview: MessagePreview,
): Promise<void> {
  if (!redis) return

  try {
    await redis.set(cacheKeys.messagePreview(conversationId), preview, {
      ex: CACHE_TTL.MESSAGE_PREVIEW,
    })
  } catch (error) {
    console.error('Redis set error (message preview):', error)
  }
}

// Invalidate cache keys
export async function invalidateCache(keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return

  try {
    await redis.del(...keys)
  } catch (error) {
    console.error('Redis delete error:', error)
  }
}

// Helper functions for common invalidation patterns
export async function invalidateOnConversationCreate(): Promise<void> {
  await invalidateCache(invalidationKeys.onConversationCreate())
}

export async function invalidateOnConversationUpdate(
  conversationId: string,
): Promise<void> {
  await invalidateCache(invalidationKeys.onConversationUpdate(conversationId))
}

export async function invalidateOnConversationDelete(
  conversationId: string,
): Promise<void> {
  await invalidateCache(invalidationKeys.onConversationDelete(conversationId))
}

export async function invalidateOnNewMessage(
  conversationId: string,
): Promise<void> {
  await invalidateCache(invalidationKeys.onNewMessage(conversationId))
}

export async function invalidateOnTitleGenerated(): Promise<void> {
  await invalidateCache(invalidationKeys.onTitleGenerated())
}
