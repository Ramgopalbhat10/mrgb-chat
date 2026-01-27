import { createFileRoute } from '@tanstack/react-router'
import { asc, eq } from 'drizzle-orm'

import { db } from '@/server/db'
import { conversations, messages } from '@/server/db/schema'
import {
  invalidateOnConversationCreate,
  invalidateOnNewMessage,
  incrementCacheVersion,
} from '@/server/cache'
import { requireAuth } from '@/server/auth/get-session'

type BranchRequest = {
  assistantMessageId: string
  newConversationId?: string
  messageIdMap?: Array<{ sourceMessageId: string; newMessageId: string }>
}

export const Route = createFileRoute('/api/conversations/$id/branch')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        try {
          const body = (await request.json()) as BranchRequest

          if (!body?.assistantMessageId) {
            return new Response('assistantMessageId is required', { status: 400 })
          }

          const [sourceConversation] = await db
            .select()
            .from(conversations)
            .where(eq(conversations.id, params.id))
            .limit(1)

          if (!sourceConversation) {
            return new Response('Conversation not found', { status: 404 })
          }

          const sourceMessages = await db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, params.id))
            .orderBy(asc(messages.createdAt))

          const pivotIndex = sourceMessages.findIndex(
            (message) => message.id === body.assistantMessageId,
          )
          const pivotMessage =
            pivotIndex >= 0 ? sourceMessages[pivotIndex] : null

          if (!pivotMessage) {
            return new Response('Assistant message not found', { status: 404 })
          }

          if (pivotMessage.role !== 'assistant') {
            return new Response('Branching is only allowed from assistant messages', {
              status: 400,
            })
          }

          const messagesToCopy = sourceMessages.slice(0, pivotIndex + 1)
          if (messagesToCopy.length === 0) {
            return new Response('No messages to branch from', { status: 400 })
          }

          const now = new Date()
          const newConversationId = body.newConversationId ?? crypto.randomUUID()
          const baseTitle = sourceConversation.title || 'New conversation'
          const branchTitle = baseTitle
          const baseTime =
            now.getTime() - Math.max(messagesToCopy.length - 1, 0) * 1000

          const idMap = new Map<string, string>()
          if (Array.isArray(body.messageIdMap)) {
            for (const entry of body.messageIdMap) {
              if (!entry?.sourceMessageId || !entry?.newMessageId) continue
              idMap.set(entry.sourceMessageId, entry.newMessageId)
            }
          }

          let pivotNewMessageId: string | null = null
          const newMessages = messagesToCopy.map((message, index) => {
            const newMessageId = idMap.get(message.id) ?? crypto.randomUUID()
            if (message.id === body.assistantMessageId) {
              pivotNewMessageId = newMessageId
            }
            return {
              id: newMessageId,
              conversationId: newConversationId,
              role: message.role,
              content: message.content,
              clientId: null,
              metaJson: message.metaJson ?? null,
              createdAt: new Date(baseTime + index * 1000),
            }
          })

          const lastMessageAt =
            newMessages[newMessages.length - 1]?.createdAt ?? now

          const newConversation = {
            id: newConversationId,
            title: branchTitle,
            starred: false,
            archived: false,
            isPublic: false,
            forkedFromConversationId: params.id,
            forkedFromMessageId: pivotNewMessageId ?? body.assistantMessageId,
            forkedAt: now,
            createdAt: now,
            updatedAt: now,
            lastMessageAt,
          }

          await db.transaction(async (tx) => {
            await tx.insert(conversations).values(newConversation)
            await tx.insert(messages).values(newMessages)
          })

          await invalidateOnConversationCreate()
          await invalidateOnNewMessage(newConversationId)
          await incrementCacheVersion()

          const resolvedMessageMap = newMessages.map((message, index) => ({
            sourceMessageId: messagesToCopy[index]?.id ?? '',
            newMessageId: message.id,
          }))

          return Response.json({
            conversationId: newConversationId,
            messageIdMap: resolvedMessageMap,
          })
        } catch (error) {
          console.error('Failed to branch conversation:', error)
          return new Response('Failed to branch conversation', { status: 500 })
        }
      },
    },
  },
})
