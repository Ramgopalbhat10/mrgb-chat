import { conversationKeys } from './queries'
import type { QueryClient } from '@tanstack/react-query'
import type { Conversation, Message } from '@/lib/indexeddb'
import * as db from '@/lib/indexeddb'

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
  updater: (current: Array<Conversation>) => Array<Conversation>,
) {
  queryClient.setQueryData<Array<Conversation>>(conversationKeys.list(), (old) => {
    const current = old ?? []
    return updater(current)
  })
}

export function updateMessagesCache(
  queryClient: QueryClient,
  conversationId: string,
  updater: (current: Array<Message>) => Array<Message>,
) {
  queryClient.setQueryData<Array<Message>>(
    conversationKeys.messages(conversationId),
    (old) => {
      const current = old ?? []
      return updater(current)
    },
  )
}
