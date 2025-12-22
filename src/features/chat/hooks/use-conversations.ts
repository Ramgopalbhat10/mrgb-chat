import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { useAppStore } from '@/stores/app-store'
import * as db from '@/lib/indexeddb'
import type { Conversation } from '@/lib/indexeddb'

const PAGE_SIZE = 30

interface ConversationTitle {
  id: string
  title: string
  lastMessageAt: string | null
  starred?: boolean
  archived?: boolean
}

interface ConversationsPage {
  conversations: ConversationTitle[]
  nextCursor: string | null
  hasMore: boolean
}

async function fetchConversationsPage(params: {
  cursor?: string
  limit?: number
  archived?: boolean
}): Promise<ConversationsPage> {
  const searchParams = new URLSearchParams()
  if (params.cursor) searchParams.set('cursor', params.cursor)
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.archived !== undefined)
    searchParams.set('archived', String(params.archived))

  const response = await fetch(`/api/conversations?${searchParams}`)
  if (!response.ok) {
    throw new Error('Failed to fetch conversations')
  }

  return response.json()
}

export function useConversationsInfinite(archived = false) {

  return useInfiniteQuery({
    queryKey: queryKeys.conversations.list({ archived }),
    queryFn: async ({ pageParam }) => {
      const result = await fetchConversationsPage({
        cursor: pageParam,
        limit: PAGE_SIZE,
        archived,
      })

      // Sync to IndexedDB for offline support (first page only)
      if (!pageParam) {
        for (const conv of result.conversations) {
          const existing = await db.getConversation(conv.id)
          if (existing) {
            await db.updateConversation(conv.id, {
              title: conv.title,
              lastMessageAt: conv.lastMessageAt
                ? new Date(conv.lastMessageAt)
                : null,
            })
          }
        }
      }

      return result
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()
  const addConversation = useAppStore((state) => state.addConversation)

  return useMutation({
    mutationFn: async (conversation: Conversation) => {
      // Persist to server
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversation),
      })

      if (!response.ok) {
        throw new Error('Failed to create conversation')
      }

      return response.json()
    },
    onMutate: async (newConversation) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.conversations.all,
      })

      // Optimistic update to Zustand store (which syncs to IndexedDB)
      await addConversation(newConversation)

      return { newConversation }
    },
    onSuccess: () => {
      // Invalidate conversations query to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all })
    },
    onError: (error) => {
      console.error('Failed to create conversation:', error)
      // Rollback would happen via Zustand store
    },
  })
}

export function useUpdateConversation() {
  const queryClient = useQueryClient()
  const updateConversation = useAppStore((state) => state.updateConversation)

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Conversation>
    }) => {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update conversation')
      }

      return response.json()
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.conversations.all,
      })

      // Optimistic update
      await updateConversation(id, updates)

      return { id, updates }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all })
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  const deleteConversation = useAppStore((state) => state.deleteConversation)

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete conversation')
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.conversations.all,
      })

      // Optimistic delete
      await deleteConversation(id)

      return { id }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all })
    },
  })
}

export function useArchiveConversation() {
  const updateMutation = useUpdateConversation()

  return {
    archive: (id: string) =>
      updateMutation.mutate({ id, updates: { archived: true } as any }),
    unarchive: (id: string) =>
      updateMutation.mutate({ id, updates: { archived: false } as any }),
    isPending: updateMutation.isPending,
  }
}
