import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/server/db/drizzle'
import { sharedMessages, conversations } from '@/server/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth } from '@/server/auth/get-session'

export const Route = createFileRoute('/api/share')({
  server: {
    handlers: {
      // Create a new shared message
      POST: async ({ request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        try {
          const { userInput, response, modelId, messageId, conversationId } = await request.json()

          if (!userInput || !response) {
            return new Response(
              JSON.stringify({ error: 'userInput and response are required' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
          }

          const id = crypto.randomUUID().slice(0, 8)

          await db.insert(sharedMessages).values({
            id,
            originalMessageId: messageId || null,
            conversationId: conversationId || null,
            userInput,
            response,
            modelId: modelId || null,
          })

          const shareUrl = `${new URL(request.url).origin}/s/${id}`

          return new Response(
            JSON.stringify({ id, url: shareUrl }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          console.error('Failed to create shared message:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to create shared message' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      },

      // Delete a shared message
      DELETE: async ({ request }) => {
        const auth = await requireAuth(request)
        if (!auth.authorized) return auth.response

        try {
          const url = new URL(request.url)
          const id = url.searchParams.get('id')

          if (!id) {
            return new Response(
              JSON.stringify({ error: 'id is required' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
          }

          await db.delete(sharedMessages).where(eq(sharedMessages.id, id))

          return new Response(
            JSON.stringify({ success: true }),
            { headers: { 'Content-Type': 'application/json' } }
          )
        } catch (error) {
          console.error('Failed to delete shared message:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to delete shared message' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      },

      // Get a shared message by ID or list all shared items
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const id = url.searchParams.get('id')
          const list = url.searchParams.get('list')

          // If listing all shared items (requires auth)
          if (list === 'true') {
            const auth = await requireAuth(request)
            if (!auth.authorized) return auth.response

            // Get shared responses from sharedMessages table
            const sharedResponses = await db
              .select()
              .from(sharedMessages)
              .orderBy(desc(sharedMessages.createdAt))

            // Get public conversations from conversations table
            const publicConversations = await db
              .select()
              .from(conversations)
              .where(eq(conversations.isPublic, true))
              .orderBy(desc(conversations.updatedAt))

            // Transform public conversations to match shared item format
            const conversationItems = publicConversations.map(conv => ({
              id: conv.id,
              type: 'conversation' as const,
              title: conv.title,
              conversationId: conv.id,
              originalMessageId: null,
              createdAt: conv.createdAt,
              updatedAt: conv.updatedAt,
            }))

            // Transform shared responses
            const responseItems = sharedResponses.map(item => ({
              ...item,
              type: 'response' as const,
              title: item.userInput?.slice(0, 100) || 'Shared response',
            }))

            return new Response(
              JSON.stringify({
                conversations: conversationItems,
                responses: responseItems,
                counts: {
                  responses: responseItems.length,
                  conversations: conversationItems.length,
                  total: responseItems.length + conversationItems.length,
                },
              }),
              { headers: { 'Content-Type': 'application/json' } }
            )
          }

          // Get single shared message (public)
          if (!id) {
            return new Response(
              JSON.stringify({ error: 'id is required' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
          }

          const [shared] = await db
            .select()
            .from(sharedMessages)
            .where(eq(sharedMessages.id, id))
            .limit(1)

          if (!shared) {
            return new Response(
              JSON.stringify({ error: 'Shared message not found' }),
              { status: 404, headers: { 'Content-Type': 'application/json' } }
            )
          }

          return new Response(JSON.stringify(shared), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('Failed to fetch shared message:', error)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch shared message' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      },
    },
  },
})
