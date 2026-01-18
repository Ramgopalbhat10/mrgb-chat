import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { conversationKeys, projectKeys, sharedKeys } from '@/features/chat/data/queries'
import { useActiveConversationId } from '@/stores/app-store'
import { useAuth } from '@/providers/auth-provider'

interface CacheSyncOptions {
  intervalMs?: number
  enabled?: boolean
}

export function useCacheVersionSync({
  intervalMs = 5 * 60_000,
  enabled = true,
}: CacheSyncOptions = {}) {
  const queryClient = useQueryClient()
  const activeConversationId = useActiveConversationId()
  const { isAuthenticated } = useAuth()
  const lastVersionRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled || !isAuthenticated) return

    let isMounted = true
    let timer: ReturnType<typeof setInterval> | null = null

    const tick = async () => {
      try {
        if (
          typeof document !== 'undefined' &&
          document.visibilityState !== 'visible'
        ) {
          return
        }

        const response = await fetch('/api/cache-version')
        if (!response.ok) return

        const { version } = await response.json()
        if (!isMounted) return

        if (version !== lastVersionRef.current) {
          lastVersionRef.current = version
          queryClient.invalidateQueries({ queryKey: conversationKeys.list() })
          if (activeConversationId) {
            queryClient.invalidateQueries({
              queryKey: conversationKeys.messages(activeConversationId),
            })
          }
          queryClient.invalidateQueries({ queryKey: projectKeys.all })
          queryClient.invalidateQueries({ queryKey: sharedKeys.all })
        }
      } catch (error) {
        console.warn('Failed to poll cache version:', error)
      }
    }

    tick()
    timer = setInterval(tick, intervalMs)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      isMounted = false
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [activeConversationId, enabled, intervalMs, isAuthenticated, queryClient])
}
