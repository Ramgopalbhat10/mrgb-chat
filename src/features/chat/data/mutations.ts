import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Conversation, Message } from '@/lib/indexeddb'
import * as db from '@/lib/indexeddb'
import { conversationKeys } from './queries'
import {
  updateConversationCache,
  updateMessagesCache,
} from './persistence'
import { useAppStore } from '@/stores/app-store'

// Optimistic update helpers
function generateClientId() {
  return `client_${crypto.randomUUID()}`
}

function normalizeServerConversation(server: any, modelId?: string): Conversation {
  return {
    id: server.id,
    title: server.title,
    starred: server.starred ?? false,
    archived: server.archived ?? false,
    isPublic: server.isPublic ?? false,
    revision: server.revision,
    forkedFromConversationId: server.forkedFromConversationId ?? null,
    forkedFromMessageId: server.forkedFromMessageId ?? null,
    forkedAt: server.forkedAt ? new Date(server.forkedAt) : null,
    modelId,
    createdAt: new Date(server.createdAt),
    updatedAt: new Date(server.updatedAt),
    lastMessageAt: server.lastMessageAt
      ? new Date(server.lastMessageAt)
      : null,
  }
}

export function useCreateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Conversation) => {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: data.id,
          title: data.title,
          starred: data.starred,
          archived: data.archived,
          isPublic: data.isPublic,
          forkedFromConversationId: data.forkedFromConversationId ?? null,
          forkedFromMessageId: data.forkedFromMessageId ?? null,
          forkedAt: data.forkedAt ?? null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          lastMessageAt: data.lastMessageAt,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to create conversation')
      }
      return response.json()
    },
    onMutate: async (newConversation) => {
      await queryClient.cancelQueries({ queryKey: conversationKeys.all })

      const previousConversations = queryClient.getQueryData<Conversation[]>(
        conversationKeys.list(),
      )

      const optimisticConversation: Conversation = {
        ...newConversation,
        id: newConversation.id ?? generateClientId(),
        createdAt: newConversation.createdAt ?? new Date(),
        updatedAt: newConversation.updatedAt ?? new Date(),
      }

      updateConversationCache(queryClient, (current) => [
        optimisticConversation,
        ...current,
      ])

      await db.createConversation(optimisticConversation)

      return { previousConversations, optimisticConversation }
    },
    onError: async (_err, _newConversation, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(
          conversationKeys.list(),
          context.previousConversations,
        )
      }
      if (context?.optimisticConversation) {
        await db.deleteConversation(context.optimisticConversation.id)
      }
    },
    onSuccess: async (data, _variables, context) => {
      const modelId = context?.optimisticConversation.modelId
      const normalized = normalizeServerConversation(data, modelId)

      updateConversationCache(queryClient, (current) =>
        current.map((conv) =>
          conv.id === context?.optimisticConversation.id ? normalized : conv,
        ),
      )

      await db.updateConversation(normalized.id, normalized)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.list() })
    },
  })
}

export function useUpdateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Conversation>
    }) => {
      const { modelId, ...serverUpdates } = updates
      const hasServerUpdates = Object.keys(serverUpdates).length > 0

      if (!hasServerUpdates) {
        return null
      }

      const response = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverUpdates),
      })
      if (!response.ok) {
        throw new Error('Failed to update conversation')
      }
      return response.json()
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: conversationKeys.all })

      const previousConversations = queryClient.getQueryData<Conversation[]>(
        conversationKeys.list(),
      )
      const previousConversation = previousConversations?.find(
        (conv) => conv.id === id,
      )

      updateConversationCache(queryClient, (current) =>
        current.map((conv) =>
          conv.id === id
            ? { ...conv, ...updates, updatedAt: new Date() }
            : conv,
        ),
      )

      await db.updateConversation(id, updates)

      return { previousConversations, previousConversation }
    },
    onError: async (_err, _variables, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(
          conversationKeys.list(),
          context.previousConversations,
        )
      }
      if (context?.previousConversation) {
        await db.updateConversation(
          context.previousConversation.id,
          context.previousConversation,
        )
      }
    },
    onSuccess: async (data, variables) => {
      if (!data || !('id' in data)) return

      const existing = queryClient
        .getQueryData<Conversation[]>(conversationKeys.list())
        ?.find((conv) => conv.id === variables.id)
      const normalized = normalizeServerConversation(data, existing?.modelId)

      updateConversationCache(queryClient, (current) =>
        current.map((conv) => (conv.id === normalized.id ? normalized : conv)),
      )

      await db.updateConversation(normalized.id, normalized)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.list() })
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete conversation')
      }
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: conversationKeys.all })

      const previousConversations = queryClient.getQueryData<Conversation[]>(
        conversationKeys.list(),
      )

      updateConversationCache(queryClient, (current) =>
        current.filter((conv) => conv.id !== deletedId),
      )

      await db.deleteConversation(deletedId)

      return { previousConversations }
    },
    onError: async (_err, _deletedId, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(
          conversationKeys.list(),
          context.previousConversations,
        )
        await Promise.all(
          context.previousConversations.map((conv) => db.createConversation(conv)),
        )
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.list() })
    },
  })
}

export function useGenerateTitle() {
  const queryClient = useQueryClient()
  const addTitleLoading = useAppStore((state) => state.addTitleLoading)
  const removeTitleLoading = useAppStore((state) => state.removeTitleLoading)

  return useMutation({
    mutationFn: async ({
      conversationId,
      userMessage,
    }: {
      conversationId: string
      userMessage: string
    }) => {
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, userMessage }),
      })
      if (!response.ok) {
        throw new Error('Failed to generate title')
      }
      return response.json() as Promise<{ title: string; conversationId: string }>
    },
    onMutate: async ({ conversationId }) => {
      addTitleLoading(conversationId)
    },
    onSuccess: async ({ title, conversationId }) => {
      updateConversationCache(queryClient, (current) =>
        current.map((conv) =>
          conv.id === conversationId
            ? { ...conv, title, updatedAt: new Date() }
            : conv,
        ),
      )

      await db.updateConversation(conversationId, { title })
    },
    onSettled: (_data, _error, variables) => {
      removeTitleLoading(variables.conversationId)
      queryClient.invalidateQueries({ queryKey: conversationKeys.list() })
    },
  })
}

export function useAppendMessageToCache(conversationId: string) {
  const queryClient = useQueryClient()

  return (message: Message) => {
    updateMessagesCache(queryClient, conversationId, (current) => [
      ...current,
      message,
    ])

    updateConversationCache(queryClient, (current) =>
      current.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              lastMessageAt: message.createdAt,
              updatedAt: new Date(),
            }
          : conv,
      ),
    )
  }
}
