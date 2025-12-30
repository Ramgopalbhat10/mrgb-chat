import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Conversation, Message } from '@/lib/indexeddb'
import * as db from '@/lib/indexeddb'

interface PendingNewChat {
  conversationId: string
  initialMessage: string
}

interface AppState {
  // State
  conversations: Conversation[]
  activeConversationId: string | null
  pendingNewChat: PendingNewChat | null // Pending new chat from /new route
  messages: Record<string, Message[]> // conversationId -> messages
  isHydrated: boolean
  titleLoadingIds: Set<string> // conversation IDs currently generating titles
  lastKnownCacheVersion: number // For cross-device sync

  // Actions
  hydrate: () => Promise<void>
  checkAndSync: () => Promise<boolean> // Returns true if sync was needed

  // Conversation actions
  setActiveConversationId: (id: string | null) => void
  addConversation: (conversation: Conversation) => Promise<void>
  updateConversation: (
    id: string,
    updates: Partial<Conversation>,
  ) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  generateTitle: (conversationId: string, userMessage: string) => Promise<void>

  // Message actions
  loadMessages: (conversationId: string) => Promise<void>
  addMessage: (message: Message) => Promise<void>
  updateMessage: (id: string, updates: Partial<Message>) => Promise<void>

  // Derived actions
  handleNewChat: () => void
  handleSelectConversation: (id: string) => void
  setPendingNewChat: (pending: PendingNewChat | null) => void
  consumePendingNewChat: () => PendingNewChat | null

  // Selectors
  isTitleLoading: (conversationId: string) => boolean
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    conversations: [],
    activeConversationId: null,
    pendingNewChat: null,
    messages: {},
    isHydrated: false,
    titleLoadingIds: new Set<string>(),
    lastKnownCacheVersion: 0,

    // Selector for title loading
    isTitleLoading: (conversationId: string) => {
      return get().titleLoadingIds.has(conversationId)
    },

    // Hydrate: IndexedDB first (instant), then sync from server (fresh data)
    hydrate: async () => {
      if (typeof window === 'undefined') return

      try {
        // Step 1: Load from IndexedDB for instant UI (local-first)
        const { conversations: localConversations } =
          await db.hydrateFromIndexedDB()
        set({
          conversations: localConversations,
          isHydrated: true,
        })

        // Step 2: Fetch from server (Redis -> Turso) for fresh data
        try {
          const response = await fetch('/api/conversations')
          if (response.ok) {
            const data = await response.json()
            // Handle both paginated response and legacy array response
            const serverTitles = Array.isArray(data)
              ? data
              : data.conversations || []

            // Transform server response to Conversation format
            const serverConversations: Conversation[] = serverTitles.map(
              (t: {
                id: string
                title: string
                lastMessageAt: string | null
                starred?: boolean
                archived?: boolean
                isPublic?: boolean
              }) => ({
                id: t.id,
                title: t.title,
                starred: t.starred ?? false,
                archived: t.archived ?? false,
                isPublic: t.isPublic ?? false,
                createdAt: new Date(),
                updatedAt: new Date(),
                lastMessageAt: t.lastMessageAt ? new Date(t.lastMessageAt) : null,
              }),
            )

            // Server is source of truth - merge server data with local metadata
            const serverIds = new Set(serverConversations.map((c) => c.id))
            
            const mergedConversations = serverConversations.map((serverConv) => {
              const localConv = localConversations.find((c) => c.id === serverConv.id)
              return localConv
                ? {
                    ...localConv,
                    title: serverConv.title,
                    lastMessageAt: serverConv.lastMessageAt,
                    starred: serverConv.starred,
                    archived: serverConv.archived,
                    isPublic: serverConv.isPublic,
                  }
                : serverConv
            })

            // Sort by lastMessageAt descending
            const finalConversations = mergedConversations.sort(
              (a, b) =>
                (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0),
            )

            set({ conversations: finalConversations })

            // Sync IndexedDB with server state:
            // 1. Update/create server conversations in IndexedDB
            for (const conv of serverConversations) {
              const existing = await db.getConversation(conv.id)
              if (existing) {
                await db.updateConversation(conv.id, {
                  title: conv.title,
                  lastMessageAt: conv.lastMessageAt,
                  starred: conv.starred,
                  archived: conv.archived,
                  isPublic: conv.isPublic,
                })
              } else {
                await db.createConversation(conv)
              }
            }
            
            // 2. Remove local conversations that no longer exist on server
            // This ensures cross-device sync when conversations are deleted elsewhere
            const localOnly = localConversations.filter((c) => !serverIds.has(c.id))
            for (const conv of localOnly) {
              await db.deleteConversation(conv.id)
            }
          }
        } catch (serverError) {
          // Server fetch failed - continue with local data (offline mode)
          console.warn('Failed to sync with server, using local data:', serverError)
        }
      } catch (error) {
        console.error('Failed to hydrate from IndexedDB:', error)
        set({
          isHydrated: true,
        })
      }
    },

    // Check cache version and sync if needed (for cross-device sync)
    checkAndSync: async () => {
      if (typeof window === 'undefined') return false

      try {
        const response = await fetch('/api/cache-version')
        if (!response.ok) return false

        const { version } = await response.json()
        const { lastKnownCacheVersion } = get()

        // If version changed, trigger a full re-sync
        if (version !== lastKnownCacheVersion) {
          set({ lastKnownCacheVersion: version })

          // Re-fetch conversations from server
          const convResponse = await fetch('/api/conversations')
          if (convResponse.ok) {
            const data = await convResponse.json()
            const serverTitles = Array.isArray(data)
              ? data
              : data.conversations || []

            const serverConversations: Conversation[] = serverTitles.map(
              (t: {
                id: string
                title: string
                lastMessageAt: string | null
                starred?: boolean
                archived?: boolean
                isPublic?: boolean
              }) => ({
                id: t.id,
                title: t.title,
                starred: t.starred ?? false,
                archived: t.archived ?? false,
                isPublic: t.isPublic ?? false,
                createdAt: new Date(),
                updatedAt: new Date(),
                lastMessageAt: t.lastMessageAt ? new Date(t.lastMessageAt) : null,
              }),
            )

            const serverIds = new Set(serverConversations.map((c) => c.id))
            const { conversations: localConversations } = get()

            // Merge with local data
            const mergedConversations = serverConversations.map((serverConv) => {
              const localConv = localConversations.find((c) => c.id === serverConv.id)
              return localConv
                ? {
                    ...localConv,
                    title: serverConv.title,
                    lastMessageAt: serverConv.lastMessageAt,
                    starred: serverConv.starred,
                    archived: serverConv.archived,
                    isPublic: serverConv.isPublic,
                  }
                : serverConv
            })

            const finalConversations = mergedConversations.sort(
              (a, b) =>
                (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0),
            )

            set({ conversations: finalConversations })

            // Sync IndexedDB - update/create server conversations
            for (const conv of serverConversations) {
              const existing = await db.getConversation(conv.id)
              if (existing) {
                await db.updateConversation(conv.id, {
                  title: conv.title,
                  lastMessageAt: conv.lastMessageAt,
                  starred: conv.starred,
                  archived: conv.archived,
                  isPublic: conv.isPublic,
                })
              } else {
                await db.createConversation(conv)
              }
            }

            // Remove local conversations that no longer exist on server
            const localOnly = localConversations.filter((c) => !serverIds.has(c.id))
            for (const conv of localOnly) {
              await db.deleteConversation(conv.id)
            }
          }

          return true // Sync was needed
        }

        return false // No sync needed
      } catch (error) {
        console.error('Failed to check cache version:', error)
        return false
      }
    },

    // Conversation actions
    setActiveConversationId: (id) => {
      set({ activeConversationId: id })
    },

    addConversation: async (conversation) => {
      // Optimistic update
      set((state) => ({
        conversations: [conversation, ...state.conversations],
      }))

      // Persist to IndexedDB (local-first)
      try {
        await db.createConversation(conversation)
      } catch (error) {
        console.error('Failed to persist conversation to IndexedDB:', error)
        // Rollback on error
        set((state) => ({
          conversations: state.conversations.filter(
            (c) => c.id !== conversation.id,
          ),
        }))
        return
      }

      // Persist to server (blocking - must complete before messages can be sent)
      try {
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(conversation),
        })
        if (!response.ok) {
          console.error('Failed to persist conversation to server:', response.statusText)
        }
      } catch (error) {
        console.error('Failed to persist conversation to server:', error)
      }
    },

    updateConversation: async (id, updates) => {
      const { conversations } = get()
      const original = conversations.find((c) => c.id === id)

      // Optimistic update
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c,
        ),
      }))

      // Persist to IndexedDB (local-first)
      try {
        await db.updateConversation(id, updates)
      } catch (error) {
        console.error('Failed to update conversation in IndexedDB:', error)
        // Rollback on error
        if (original) {
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? original : c,
            ),
          }))
        }
        return
      }

      // Persist to server (fire-and-forget)
      fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).catch((error) => {
        console.error('Failed to update conversation on server:', error)
      })
    },

    deleteConversation: async (id) => {
      const { conversations, activeConversationId } = get()
      const original = conversations.find((c) => c.id === id)

      // Optimistic update
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversationId:
          activeConversationId === id
            ? crypto.randomUUID()
            : activeConversationId,
      }))

      // Persist to IndexedDB (local-first)
      try {
        await db.deleteConversation(id)
      } catch (error) {
        console.error('Failed to delete conversation from IndexedDB:', error)
        // Rollback on error
        if (original) {
          set((state) => ({
            conversations: [...state.conversations, original].sort(
              (a, b) =>
                (b.lastMessageAt?.getTime() ?? 0) -
                (a.lastMessageAt?.getTime() ?? 0),
            ),
          }))
        }
        return
      }

      // Persist to server (fire-and-forget)
      fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      }).catch((error) => {
        console.error('Failed to delete conversation from server:', error)
      })
    },

    // Message actions
    loadMessages: async (conversationId) => {
      try {
        const messages = await db.getMessagesByConversation(conversationId)
        set((state) => ({
          messages: { ...state.messages, [conversationId]: messages },
        }))
      } catch (error) {
        console.error('Failed to load messages:', error)
      }
    },

    addMessage: async (message) => {
      const { conversations } = get()

      // Optimistic update
      set((state) => ({
        messages: {
          ...state.messages,
          [message.conversationId]: [
            ...(state.messages[message.conversationId] ?? []),
            message,
          ],
        },
      }))

      // Persist to IndexedDB
      try {
        await db.createMessage(message)

        // Update conversation's lastMessageAt in state
        const conversation = conversations.find(
          (c) => c.id === message.conversationId,
        )
        if (conversation) {
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === message.conversationId
                ? {
                    ...c,
                    lastMessageAt: message.createdAt,
                    updatedAt: new Date(),
                  }
                : c,
            ),
          }))
        }
      } catch (error) {
        console.error('Failed to persist message:', error)
        // Rollback on error
        set((state) => ({
          messages: {
            ...state.messages,
            [message.conversationId]: (
              state.messages[message.conversationId] ?? []
            ).filter((m) => m.id !== message.id),
          },
        }))
      }
    },

    updateMessage: async (id, updates) => {
      const { messages } = get()
      let conversationId: string | null = null
      let original: Message | undefined

      // Find the message to update
      for (const [convId, convMessages] of Object.entries(messages)) {
        const msg = convMessages.find((m) => m.id === id)
        if (msg) {
          conversationId = convId
          original = msg
          break
        }
      }

      if (!conversationId || !original) return

      // Optimistic update
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId!]: (state.messages[conversationId!] ?? []).map((m) =>
            m.id === id ? { ...m, ...updates } : m,
          ),
        },
      }))

      // Persist to IndexedDB
      try {
        await db.updateMessage(id, updates)
      } catch (error) {
        console.error('Failed to update message:', error)
        // Rollback on error
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId!]: (state.messages[conversationId!] ?? []).map(
              (m) => (m.id === id ? original! : m),
            ),
          },
        }))
      }
    },

    // Title generation (non-blocking)
    generateTitle: async (conversationId: string, userMessage: string) => {
      // Add to loading set
      set((state) => ({
        titleLoadingIds: new Set([...state.titleLoadingIds, conversationId]),
      }))

      try {
        const response = await fetch('/api/generate-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, userMessage }),
        })

        if (!response.ok) {
          throw new Error('Failed to generate title')
        }

        const { title } = await response.json()

        // Update conversation title
        const { conversations } = get()
        const conversation = conversations.find((c) => c.id === conversationId)
        if (conversation) {
          // Optimistic update
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === conversationId
                ? { ...c, title, updatedAt: new Date() }
                : c,
            ),
          }))

          // Persist to IndexedDB
          await db.updateConversation(conversationId, { title })
        }
      } catch (error) {
        console.error('Failed to generate title:', error)
        // Keep the default title on error
      } finally {
        // Remove from loading set
        set((state) => {
          const newSet = new Set(state.titleLoadingIds)
          newSet.delete(conversationId)
          return { titleLoadingIds: newSet }
        })
      }
    },

    // Derived actions
    handleNewChat: () => {
      set({ activeConversationId: null })
    },

    handleSelectConversation: (id) => {
      set({ activeConversationId: id })
    },

    setPendingNewChat: (pending) => {
      set({ pendingNewChat: pending })
    },

    consumePendingNewChat: () => {
      const pending = get().pendingNewChat
      if (pending) {
        set({ pendingNewChat: null })
      }
      return pending
    },
  })),
)

// Selector hooks for commonly used state
export const useConversations = () =>
  useAppStore((state) => state.conversations)
export const useActiveConversationId = () =>
  useAppStore((state) => state.activeConversationId)
export const useIsHydrated = () => useAppStore((state) => state.isHydrated)
export const useMessages = (conversationId: string) =>
  useAppStore((state) => state.messages[conversationId] ?? [])
