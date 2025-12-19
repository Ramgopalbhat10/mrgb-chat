import { useMutation, useQueryClient } from '@tanstack/react-query'
import { conversationKeys } from './queries'
import type { Conversation, NewConversation, Message } from '@/server/db/schema'

// Optimistic update helpers
function generateClientId() {
  return `client_${crypto.randomUUID()}`
}

// Create conversation mutation
export function useCreateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      data: Omit<NewConversation, 'id' | 'createdAt' | 'updatedAt'>,
    ) => {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        throw new Error('Failed to create conversation')
      }
      return response.json() as Promise<Conversation>
    },
    onMutate: async (newConversation) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: conversationKeys.lists() })

      // Snapshot previous value
      const previousConversations = queryClient.getQueryData<Conversation[]>(
        conversationKeys.list(),
      )

      // Optimistically add new conversation
      const optimisticConversation: Conversation = {
        id: generateClientId(),
        title: newConversation.title ?? 'New conversation',
        starred: newConversation.starred ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: null,
      }

      queryClient.setQueryData<Conversation[]>(
        conversationKeys.list(),
        (old) => [optimisticConversation, ...(old ?? [])],
      )

      return { previousConversations, optimisticId: optimisticConversation.id }
    },
    onError: (_err, _newConversation, context) => {
      // Rollback on error
      if (context?.previousConversations) {
        queryClient.setQueryData(
          conversationKeys.list(),
          context.previousConversations,
        )
      }
    },
    onSuccess: (data, _variables, context) => {
      // Replace optimistic conversation with real one
      queryClient.setQueryData<Conversation[]>(
        conversationKeys.list(),
        (old) =>
          old?.map((conv) =>
            conv.id === context?.optimisticId ? data : conv,
          ) ?? [data],
      )
    },
    onSettled: () => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
    },
  })
}

// Update conversation mutation (rename, star, etc.)
export function useUpdateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<Conversation> & { id: string }) => {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        throw new Error('Failed to update conversation')
      }
      return response.json() as Promise<Conversation>
    },
    onMutate: async (updatedConversation) => {
      await queryClient.cancelQueries({
        queryKey: conversationKeys.detail(updatedConversation.id),
      })
      await queryClient.cancelQueries({ queryKey: conversationKeys.lists() })

      const previousConversation = queryClient.getQueryData<Conversation>(
        conversationKeys.detail(updatedConversation.id),
      )
      const previousList = queryClient.getQueryData<Conversation[]>(
        conversationKeys.list(),
      )

      // Optimistic update
      if (previousConversation) {
        queryClient.setQueryData<Conversation>(
          conversationKeys.detail(updatedConversation.id),
          {
            ...previousConversation,
            ...updatedConversation,
            updatedAt: new Date(),
          },
        )
      }

      queryClient.setQueryData<Conversation[]>(conversationKeys.list(), (old) =>
        old?.map((conv) =>
          conv.id === updatedConversation.id
            ? { ...conv, ...updatedConversation, updatedAt: new Date() }
            : conv,
        ),
      )

      return { previousConversation, previousList }
    },
    onError: (_err, variables, context) => {
      if (context?.previousConversation) {
        queryClient.setQueryData(
          conversationKeys.detail(variables.id),
          context.previousConversation,
        )
      }
      if (context?.previousList) {
        queryClient.setQueryData(conversationKeys.list(), context.previousList)
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(variables.id),
      })
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
    },
  })
}

// Delete conversation mutation
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
      await queryClient.cancelQueries({ queryKey: conversationKeys.lists() })

      const previousConversations = queryClient.getQueryData<Conversation[]>(
        conversationKeys.list(),
      )

      // Optimistically remove
      queryClient.setQueryData<Conversation[]>(conversationKeys.list(), (old) =>
        old?.filter((conv) => conv.id !== deletedId),
      )

      return { previousConversations }
    },
    onError: (_err, _deletedId, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(
          conversationKeys.list(),
          context.previousConversations,
        )
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
    },
  })
}

// Send message mutation with optimistic update
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, role: 'user' }),
        },
      )
      if (!response.ok) {
        throw new Error('Failed to send message')
      }
      return response.json() as Promise<Message>
    },
    onMutate: async (content) => {
      await queryClient.cancelQueries({
        queryKey: conversationKeys.messages(conversationId),
      })

      const clientId = generateClientId()
      const optimisticMessage: Message = {
        id: clientId,
        conversationId,
        role: 'user',
        content,
        clientId,
        metaJson: null,
        createdAt: new Date(),
      }

      // Add optimistic message
      queryClient.setQueryData<{ messages: Message[]; nextCursor?: string }>(
        conversationKeys.messagesPage(conversationId),
        (old) => ({
          messages: [...(old?.messages ?? []), optimisticMessage],
          nextCursor: old?.nextCursor,
        }),
      )

      return { optimisticMessage }
    },
    onError: (_err, _content, context) => {
      // Remove optimistic message on error
      if (context?.optimisticMessage) {
        queryClient.setQueryData<{ messages: Message[]; nextCursor?: string }>(
          conversationKeys.messagesPage(conversationId),
          (old) => ({
            messages:
              old?.messages?.filter(
                (m) => m.id !== context.optimisticMessage.id,
              ) ?? [],
            nextCursor: old?.nextCursor,
          }),
        )
      }
    },
    onSuccess: (data, _content, context) => {
      // Replace optimistic message with real one
      queryClient.setQueryData<{ messages: Message[]; nextCursor?: string }>(
        conversationKeys.messagesPage(conversationId),
        (old) => ({
          messages: old?.messages?.map((m) =>
            m.id === context?.optimisticMessage.id ? data : m,
          ) ?? [data],
          nextCursor: old?.nextCursor,
        }),
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: conversationKeys.messages(conversationId),
      })
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
    },
  })
}
