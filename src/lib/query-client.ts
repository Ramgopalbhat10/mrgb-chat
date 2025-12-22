import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
})

// Query keys factory for type-safe and consistent keys
export const queryKeys = {
  conversations: {
    all: ['conversations'] as const,
    list: (params?: { cursor?: string; limit?: number; archived?: boolean }) =>
      ['conversations', 'list', params] as const,
    detail: (id: string) => ['conversations', 'detail', id] as const,
  },
  messages: {
    all: ['messages'] as const,
    list: (conversationId: string, cursor?: string) =>
      ['messages', 'list', conversationId, cursor] as const,
    preview: (conversationId: string) =>
      ['messages', 'preview', conversationId] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: () => ['projects', 'list'] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
  },
} as const
