import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

interface PendingNewChat {
  conversationId: string
  initialMessage: string
}

interface AppState {
  // UI state
  activeConversationId: string | null
  pendingNewChat: PendingNewChat | null
  titleLoadingIds: Set<string>
  isHydrated: boolean

  // UI actions
  setActiveConversationId: (id: string | null) => void
  setPendingNewChat: (pending: PendingNewChat | null) => void
  consumePendingNewChat: () => PendingNewChat | null
  handleNewChat: () => void
  addTitleLoading: (conversationId: string) => void
  removeTitleLoading: (conversationId: string) => void
  setHydrated: (hydrated: boolean) => void
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    activeConversationId: null,
    pendingNewChat: null,
    titleLoadingIds: new Set<string>(),
    isHydrated: false,

    setActiveConversationId: (id) => {
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

    handleNewChat: () => {
      set({ activeConversationId: null })
    },

    addTitleLoading: (conversationId) => {
      set((state) => ({
        titleLoadingIds: new Set([...state.titleLoadingIds, conversationId]),
      }))
    },

    removeTitleLoading: (conversationId) => {
      set((state) => {
        const next = new Set(state.titleLoadingIds)
        next.delete(conversationId)
        return { titleLoadingIds: next }
      })
    },

    setHydrated: (hydrated) => {
      set({ isHydrated: hydrated })
    },
  })),
)

export const useActiveConversationId = () =>
  useAppStore((state) => state.activeConversationId)
export const useIsHydrated = () => useAppStore((state) => state.isHydrated)
