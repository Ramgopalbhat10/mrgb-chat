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

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: () => [...projectKeys.lists()] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  conversations: (projectId: string) =>
    [...projectKeys.detail(projectId), 'conversations'] as const,
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

export const projectsQueryOptions = () =>
  queryOptions({
    queryKey: projectKeys.list(),
    queryFn: async () => {
      const response = await fetch('/api/projects')
      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }
      return response.json()
    },
    staleTime: 60_000, // 1 minute
  })
