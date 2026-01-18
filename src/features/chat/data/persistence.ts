import type { QueryClient } from '@tanstack/react-query'
import * as db from '@/lib/indexeddb'
import { conversationKeys } from './queries'
import type { Conversation, Message } from '@/lib/indexeddb'

export async function hydrateConversationsCache(queryClient: QueryClient) {
  if (typeof window === 'undefined') return []
  const conversations = await db.getAllConversations()
  if (conversations.length > 0) {
    queryClient.setQueryData(conversationKeys.list(), conversations)
  }
  return conversations
}

export async function hydrateMessagesCache(
  queryClient: QueryClient,
  conversationId: string,
) {
  if (typeof window === 'undefined') return []
  const messages = await db.getMessagesByConversation(conversationId)
  if (messages.length > 0) {
    queryClient.setQueryData(
      conversationKeys.messages(conversationId),
      messages,
    )
  }
  return messages
}

export function updateConversationCache(
  queryClient: QueryClient,
  updater: (current: Conversation[]) => Conversation[],
) {
  queryClient.setQueryData<Conversation[]>(conversationKeys.list(), (old) => {
    const current = old ?? []
    return updater(current)
  })
}

export function updateMessagesCache(
  queryClient: QueryClient,
  conversationId: string,
  updater: (current: Message[]) => Message[],
) {
  queryClient.setQueryData<Message[]>(
    conversationKeys.messages(conversationId),
    (old) => {
      const current = old ?? []
      return updater(current)
    },
  )
}
