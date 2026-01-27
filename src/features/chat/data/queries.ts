import { queryOptions } from '@tanstack/react-query'
import * as db from '@/lib/indexeddb'
import type { Conversation, Message } from '@/lib/indexeddb'

const CONVERSATIONS_PAGE_SIZE = 100
const MESSAGES_PAGE_SIZE = 200

const parseDateOrFallback = (
  value: string | null | undefined,
  fallback: Date,
) => (typeof value === 'string' ? new Date(value) : fallback)

const parseDateOrNow = (value: string | null | undefined) =>
  typeof value === 'string' ? new Date(value) : new Date()

const parseDateOrNull = (value: string | null | undefined) =>
  typeof value === 'string' ? new Date(value) : null

// Query keys
export const conversationKeys = {
  all: ['conversations'] as const,
  list: () => [...conversationKeys.all, 'list'] as const,
  detail: (id: string) => [...conversationKeys.all, 'detail', id] as const,
  messages: (conversationId: string) =>
    [...conversationKeys.all, conversationId, 'messages'] as const,
}

export const modelKeys = {
  all: ['models'] as const,
  available: () => [...modelKeys.all, 'available'] as const,
}

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: () => [...projectKeys.lists()] as const,
  metadata: () => [...projectKeys.all, 'metadata'] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  conversations: (projectId: string) =>
    [...projectKeys.detail(projectId), 'conversations'] as const,
}

export const sharedKeys = {
  all: ['shared'] as const,
  items: () => [...sharedKeys.all, 'items'] as const,
}

interface ServerConversation {
  id: string
  title: string
  starred: boolean
  archived: boolean
  isPublic: boolean
  createdAt?: string
  updatedAt?: string
  lastMessageAt: string | null
  revision?: number
  forkedFromConversationId?: string | null
  forkedFromMessageId?: string | null
  forkedAt?: string | null
}

async function fetchAllConversationsFromServer(): Promise<ServerConversation[]> {
  const conversations: ServerConversation[] = []
  let cursor: string | null | undefined
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({
      limit: String(CONVERSATIONS_PAGE_SIZE),
    })
    if (cursor) params.set('cursor', cursor)

    const response = await fetch(`/api/conversations?${params}`)
    if (!response.ok) {
      throw new Error('Failed to fetch conversations')
    }

    const data = await response.json()
    const items: ServerConversation[] = Array.isArray(data)
      ? data
      : data.conversations || []

    conversations.push(...items)
    const nextCursor = data.nextCursor ?? null
    if (data.hasMore && !nextCursor) {
      hasMore = false
    } else {
      hasMore = Boolean(data.hasMore)
    }
    cursor = nextCursor
  }

  return conversations
}

function mergeConversationsWithLocal(
  serverConversations: ServerConversation[],
  localConversations: Conversation[],
): Conversation[] {
  const localMap = new Map(localConversations.map((c) => [c.id, c]))

  return serverConversations.map((serverConv) => {
    const localConv = localMap.get(serverConv.id)
    const fallbackCreatedAt = localConv?.createdAt ?? new Date()
    const fallbackUpdatedAt = localConv?.updatedAt ?? new Date()

    const forkedFromConversationId =
      typeof serverConv.forkedFromConversationId === 'string'
        ? serverConv.forkedFromConversationId
        : null
    const forkedFromMessageId =
      typeof serverConv.forkedFromMessageId === 'string'
        ? serverConv.forkedFromMessageId
        : null
    const forkedAt = parseDateOrNull(serverConv.forkedAt)

    return {
      id: serverConv.id,
      title: serverConv.title,
      starred: serverConv.starred,
      archived: serverConv.archived,
      isPublic: serverConv.isPublic,
      revision: serverConv.revision,
      forkedFromConversationId,
      forkedFromMessageId,
      forkedAt,
      modelId: localConv?.modelId,
      createdAt: parseDateOrFallback(serverConv.createdAt, fallbackCreatedAt),
      updatedAt: parseDateOrFallback(serverConv.updatedAt, fallbackUpdatedAt),
      lastMessageAt: parseDateOrNull(serverConv.lastMessageAt),
    }
  })
}

async function syncConversationsToIndexedDB(conversations: Conversation[]) {
  for (const conv of conversations) {
    const existing = await db.getConversation(conv.id)
    if (existing) {
      await db.updateConversation(conv.id, {
        title: conv.title,
        starred: conv.starred,
        archived: conv.archived,
        isPublic: conv.isPublic,
        revision: conv.revision,
        forkedFromConversationId: conv.forkedFromConversationId ?? null,
        forkedFromMessageId: conv.forkedFromMessageId ?? null,
        forkedAt: conv.forkedAt ?? null,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        modelId: conv.modelId,
      })
    } else {
      await db.createConversation(conv)
    }
  }
}

async function removeLocalConversationsNotOnServer(
  localConversations: Conversation[],
  serverConversations: Conversation[],
) {
  const serverIds = new Set(serverConversations.map((c) => c.id))
  const localOnly = localConversations.filter((c) => !serverIds.has(c.id))

  for (const conv of localOnly) {
    await db.deleteConversation(conv.id)
  }
}

export const conversationsQueryOptions = () =>
  queryOptions({
    queryKey: conversationKeys.list(),
    queryFn: async (): Promise<Conversation[]> => {
      const localConversations =
        typeof window === 'undefined' ? [] : await db.getAllConversations()

      if (typeof window === 'undefined') {
        return localConversations
      }
      try {
        const serverConversations = await fetchAllConversationsFromServer()
        const merged = mergeConversationsWithLocal(
          serverConversations,
          localConversations,
        )

        if (typeof window !== 'undefined') {
          await syncConversationsToIndexedDB(merged)
          await removeLocalConversationsNotOnServer(
            localConversations,
            merged,
          )
        }

        return merged.sort(
          (a, b) =>
            (b.lastMessageAt?.getTime() ?? 0) -
            (a.lastMessageAt?.getTime() ?? 0),
        )
      } catch (error) {
        console.warn('Failed to fetch conversations, using local cache:', error)
        return localConversations.sort(
          (a, b) =>
            (b.lastMessageAt?.getTime() ?? 0) -
            (a.lastMessageAt?.getTime() ?? 0),
        )
      }
    },
    staleTime: 30_000,
  })

export const conversationDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: conversationKeys.detail(id),
    queryFn: async (): Promise<Conversation | undefined> => {
      if (typeof window !== 'undefined') {
        const cached = await db.getConversation(id)
        if (cached) return cached
      }

      const response = await fetch(`/api/conversations/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch conversation')
      }

      const serverConversation = (await response.json()) as ServerConversation
      const conversation: Conversation = {
        id: serverConversation.id,
        title: serverConversation.title,
        starred: serverConversation.starred,
        archived: serverConversation.archived,
        isPublic: serverConversation.isPublic,
        revision: serverConversation.revision,
        forkedFromConversationId:
          serverConversation.forkedFromConversationId ?? null,
        forkedFromMessageId:
          serverConversation.forkedFromMessageId ?? null,
        forkedAt: parseDateOrNull(serverConversation.forkedAt),
        modelId: undefined,
        createdAt: parseDateOrNow(serverConversation.createdAt),
        updatedAt: parseDateOrNow(serverConversation.updatedAt),
        lastMessageAt: parseDateOrNull(serverConversation.lastMessageAt),
      }

      if (typeof window !== 'undefined') {
        await db.createConversation(conversation)
      }
      return conversation
    },
    staleTime: 60_000,
  })

interface ServerMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  clientId: string | null
  metaJson: string | null
  revision?: number
  createdAt: string
}

async function fetchAllMessagesFromServer(
  conversationId: string,
): Promise<ServerMessage[]> {
  const messages: ServerMessage[] = []
  let cursor: string | undefined
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({
      limit: String(MESSAGES_PAGE_SIZE),
    })
    if (cursor) params.set('cursor', cursor)

    const response = await fetch(
      `/api/conversations/${conversationId}/messages?${params}`,
    )
    if (!response.ok) {
      throw new Error('Failed to fetch messages')
    }

    const data = await response.json()
    const items: ServerMessage[] = Array.isArray(data)
      ? data
      : data.messages || []

    messages.push(...items)
    hasMore = Boolean(data.nextCursor)
    cursor = data.nextCursor
  }

  return messages
}

function mergeMessagesWithLocal(
  serverMessages: ServerMessage[],
  localMessages: Message[],
): Message[] {
  const messageMap = new Map<string, Message>()
  const localByClientId = new Map<string, string>()

  for (const local of localMessages) {
    messageMap.set(local.id, local)
    if (local.clientId) {
      localByClientId.set(local.clientId, local.id)
    }
  }

  for (const server of serverMessages) {
    if (server.clientId) {
      const optimisticId = localByClientId.get(server.clientId)
      if (optimisticId) {
        messageMap.delete(optimisticId)
      }
    }

    const existing = messageMap.get(server.id)
    messageMap.set(server.id, {
      id: server.id,
      conversationId: server.conversationId,
      role: server.role,
      content: server.content,
      clientId: server.clientId ?? null,
      metaJson: server.metaJson ?? null,
      revision: server.revision,
      createdAt: new Date(server.createdAt),
      ...(existing?.clientId ? { clientId: existing.clientId } : {}),
    })
  }

  return Array.from(messageMap.values()).sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )
}

async function syncMessagesToIndexedDB(messages: Message[]) {
  for (const message of messages) {
    await db.createMessage(message)
  }
}

export const messagesQueryOptions = (conversationId: string) =>
  queryOptions({
    queryKey: conversationKeys.messages(conversationId),
    queryFn: async (): Promise<Message[]> => {
      const localMessages =
        typeof window === 'undefined'
          ? []
          : await db.getMessagesByConversation(conversationId)

      if (typeof window === 'undefined') {
        return localMessages
      }
      try {
        const serverMessages = await fetchAllMessagesFromServer(conversationId)
        const merged = mergeMessagesWithLocal(serverMessages, localMessages)

        if (typeof window !== 'undefined') {
          await syncMessagesToIndexedDB(merged)
        }
        return merged
      } catch (error) {
        console.warn('Failed to fetch messages, using local cache:', error)
        return localMessages
      }
    },
    staleTime: 30_000,
    gcTime: 0,
  })

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  conversationCount: number
}

export interface ProjectMetadata {
  projects: Project[]
  conversationProjects: Record<string, string[]>
}

export interface SharedConversation {
  id: string
  title: string
  createdAt: string
  lastMessageAt: string | null
}

export interface SharedResponse {
  id: string
  userInput: string
  response: string
  originalMessageId: string | null
  conversationId: string | null
  createdAt: string
  modelId?: string | null
}

export interface SharedItems {
  conversations: SharedConversation[]
  responses: SharedResponse[]
  counts: { conversations: number; responses: number; total: number }
}

export const projectsQueryOptions = () =>
  queryOptions({
    queryKey: projectKeys.list(),
    queryFn: async (): Promise<Project[]> => {
      const response = await fetch('/api/projects')
      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }
      return response.json()
    },
    staleTime: 5 * 60_000,
  })

export const projectsMetadataQueryOptions = () =>
  queryOptions({
    queryKey: projectKeys.metadata(),
    queryFn: async (): Promise<ProjectMetadata> => {
      const response = await fetch('/api/projects/metadata')
      if (!response.ok) {
        throw new Error('Failed to fetch projects metadata')
      }
      return response.json()
    },
    staleTime: 5 * 60_000,
  })

export const projectConversationsQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: projectKeys.conversations(projectId),
    queryFn: async (): Promise<string[]> => {
      const response = await fetch(`/api/projects/${projectId}/conversations`)
      if (!response.ok) {
        throw new Error('Failed to fetch project conversations')
      }
      return response.json()
    },
    staleTime: 2 * 60_000,
  })

export const sharedItemsQueryOptions = () =>
  queryOptions({
    queryKey: sharedKeys.items(),
    queryFn: async (): Promise<SharedItems> => {
      const response = await fetch('/api/share?list=true')
      if (!response.ok) {
        throw new Error('Failed to fetch shared items')
      }
      return response.json()
    },
    staleTime: 5 * 60_000,
  })

export interface ModelMetadata {
  id: string
  name: string
  description?: string
  context_window?: number
  max_tokens?: number
  owned_by: string
  tags?: string[]
  pricing?: {
    input: string
    output: string
    cachedInputTokens?: string
    cacheCreationInputTokens?: string
  }
}

export const availableModelsQueryOptions = () =>
  queryOptions({
    queryKey: modelKeys.available(),
    queryFn: async (): Promise<ModelMetadata[]> => {
      const { getAvailableModels } = await import('@/server/ai/gateway')
      return getAvailableModels()
    },
    staleTime: 1000 * 60 * 60,
  })
