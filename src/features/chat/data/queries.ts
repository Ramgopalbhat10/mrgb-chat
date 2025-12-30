import { queryOptions } from '@tanstack/react-query'
import type { Conversation, Message } from '@/server/db/schema'

// Query keys
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filters?: { starred?: boolean }) =>
    [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
  messages: (conversationId: string) =>
    [...conversationKeys.detail(conversationId), 'messages'] as const,
  messagesPage: (conversationId: string, cursor?: string) =>
    [...conversationKeys.messages(conversationId), { cursor }] as const,
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

// Query options
export const conversationsQueryOptions = (filters?: { starred?: boolean }) =>
  queryOptions({
    queryKey: conversationKeys.list(filters),
    queryFn: async (): Promise<Conversation[]> => {
      const params = new URLSearchParams()
      if (filters?.starred !== undefined) {
        params.set('starred', String(filters.starred))
      }
      const response = await fetch(`/api/conversations?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch conversations')
      }
      return response.json()
    },
    staleTime: 30_000, // 30 seconds
  })

export const conversationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: conversationKeys.detail(id),
    queryFn: async (): Promise<Conversation> => {
      const response = await fetch(`/api/conversations/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch conversation')
      }
      return response.json()
    },
    staleTime: 60_000, // 1 minute
  })

export const messagesQueryOptions = (conversationId: string, cursor?: string) =>
  queryOptions({
    queryKey: conversationKeys.messagesPage(conversationId, cursor),
    queryFn: async (): Promise<{
      messages: Message[]
      nextCursor?: string
    }> => {
      const params = new URLSearchParams()
      if (cursor) {
        params.set('cursor', cursor)
      }
      const response = await fetch(
        `/api/conversations/${conversationId}/messages?${params}`,
      )
      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }
      return response.json()
    },
    staleTime: 60_000, // 1 minute
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
    staleTime: 5 * 60_000, // 5 minutes
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
    staleTime: 5 * 60_000, // 5 minutes
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
    staleTime: 2 * 60_000, // 2 minutes
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
    staleTime: 5 * 60_000, // 5 minutes
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
    staleTime: 1000 * 60 * 60, // 1 hour
  })
