import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem, Virtualizer } from '@tanstack/virtual-core'
import type { UIMessage } from 'ai'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import type { RegenerationOptions } from '@/features/chat/types/regeneration'
import {
  ChatMessageRow,
  ShareResponseDialog,
  ReasoningTraceSheet,
  getMessageText,
  getReasoningParts,
  type ShareDialogMessage,
  type ReasoningSession,
} from '../messages'

interface ChatMessagesVirtualProps {
  messages: UIMessage[]
  isLoading?: boolean
  regeneratingMessageId?: string | null // ID of message being regenerated
  onLoadMore?: () => void
  hasMore?: boolean
  onReload?: (assistantMessageId: string, options?: RegenerationOptions) => void
  onEditMessage?: (userMessageId: string, newContent: string) => void
  onShareMessage?: (
    messageId: string,
    userInput: string,
    response: string,
  ) => Promise<string | null>
  onUnshareMessage?: (shareId: string) => Promise<boolean>
  sharedMessageMap?: Map<string, string> // originalMessageId -> shareId
  modelId?: string
  scrollToMessageId?: string
}

export function ChatMessagesVirtual({
  messages,
  isLoading,
  regeneratingMessageId,
  onLoadMore,
  hasMore,
  onReload,
  onEditMessage,
  onShareMessage,
  onUnshareMessage,
  sharedMessageMap,
  modelId,
  scrollToMessageId,
}: ChatMessagesVirtualProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const lastMessageCount = useRef(messages.length)
  const hasScrolledToTarget = useRef(false)
  const prevRegeneratingMessageIdRef = useRef<string | null>(null)
  const autoScrollEnabledRef = useRef(true)
  const scrollAnchorRef = useRef<{
    messageId: string
    offset: number
  } | null>(null)
  const wasStreamingRef = useRef(false)
  // Track original text length when regeneration starts to detect when new content arrives
  const regenerationOriginalLengthRef = useRef<number>(0)

  const [reasoningOpen, setReasoningOpen] = useState(false)
  const [reasoningMessageId, setReasoningMessageId] = useState<string | null>(
    null,
  )
  const reasoningSessionsRef = useRef<Record<string, ReasoningSession>>({})

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareDialogMessage, setShareDialogMessage] =
    useState<ShareDialogMessage>(null)
  const [shareMode, setShareMode] = useState<'private' | 'public'>('private')
  const [isUpdatingShare, setIsUpdatingShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [enteringMessageIds, setEnteringMessageIds] = useState<Set<string>>(
    () => new Set(),
  )
  const enterTimeoutsRef = useRef<Map<string, number>>(new Map())
  const lastAnimatedMessageIdRef = useRef<string | null>(null)

  const openReasoning = useCallback((messageId: string) => {
    setReasoningMessageId(messageId)
    setReasoningOpen(true)
  }, [])

  const handleShareDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) setShareDialogOpen(false)
  }, [])

  useEffect(() => {
    hasScrolledToTarget.current = false
  }, [scrollToMessageId])

  const lastMessage = messages[messages.length - 1]
  // Streaming when: normal loading with assistant message OR regenerating any message
  const isStreaming =
    (isLoading && lastMessage?.role === 'assistant') || !!regeneratingMessageId

  const reasoningSessions = useMemo(() => {
    const sessions = { ...reasoningSessionsRef.current }
    const now = Date.now()

    if (regeneratingMessageId && sessions[regeneratingMessageId]) {
      delete sessions[regeneratingMessageId]
    }

    for (const message of messages) {
      if (message.role !== 'assistant') continue
      const reasoningParts = getReasoningParts(message)
      if (reasoningParts.length === 0) continue

      const isComplete = reasoningParts.every((part) => part.state === 'done')

      if (!sessions[message.id]) {
        // First time seeing this message with reasoning
        if (isComplete) {
          // Already complete (loaded from DB) - no timing available
          // Don't set startedAt/endedAt so it shows "a moment"
          sessions[message.id] = { startedAt: 0 } // 0 indicates no real timing
        } else {
          // Live streaming - start tracking
          sessions[message.id] = { startedAt: now }
        }
      }

      // Only set endedAt if we have a valid startedAt (live tracking)
      if (
        isComplete &&
        sessions[message.id] &&
        sessions[message.id].startedAt > 0 &&
        !sessions[message.id].endedAt
      ) {
        sessions[message.id].endedAt = now
      }
    }

    return sessions
  }, [messages, regeneratingMessageId])

  useEffect(() => {
    reasoningSessionsRef.current = reasoningSessions
  }, [reasoningSessions])

  // Add loading indicator at the end (only for new messages, not regeneration)
  const showLoadingIndicator =
    isLoading && lastMessage?.role === 'user' && !regeneratingMessageId

  const totalCount = messages.length + (showLoadingIndicator ? 1 : 0)
  const rowVirtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 6,
    useAnimationFrameWithResizeObserver: true,
  })
  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const handleSizeChange = useCallback(
    (
      item: VirtualItem,
      _delta: number,
      instance: Virtualizer<HTMLDivElement, Element>,
    ) => {
      if (!autoScrollEnabledRef.current) return false
      const scrollOffset = instance.scrollOffset ?? 0
      return item.start < scrollOffset
    },
    [],
  )

  useEffect(() => {
    const virtualizer = rowVirtualizer as Virtualizer<HTMLDivElement, Element> & {
      shouldAdjustScrollPositionOnItemSizeChange?: typeof handleSizeChange
    }
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = handleSizeChange
  }, [handleSizeChange, rowVirtualizer])

  // Scroll to specific message if scrollToMessageId is provided
  useEffect(() => {
    if (!scrollToMessageId || messages.length === 0) return
    if (hasScrolledToTarget.current) return
    const targetIndex = messages.findIndex(
      (message) => message.id === scrollToMessageId,
    )
    if (targetIndex === -1) return
    hasScrolledToTarget.current = true
    rowVirtualizer.scrollToIndex(targetIndex, { align: 'start' })
  }, [messages, rowVirtualizer, scrollToMessageId])

  // Auto-scroll to bottom when new messages arrive (skip if we have a scroll target or regenerating)
  useEffect(() => {
    if (scrollToMessageId && !hasScrolledToTarget.current) return
    if (regeneratingMessageId) return // Don't scroll during regeneration
    if (messages.length > lastMessageCount.current) {
      lastMessageCount.current = messages.length
      if (autoScrollEnabledRef.current) {
        rowVirtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
      }
    }
  }, [messages.length, regeneratingMessageId, rowVirtualizer, scrollToMessageId])

  // Note: Removed auto-scroll during streaming as it caused issues during regeneration.
  // Users can manually scroll if needed. Scroll only happens for NEW messages (above effect).

  useEffect(() => {
    const prevId = prevRegeneratingMessageIdRef.current
    prevRegeneratingMessageIdRef.current = regeneratingMessageId ?? null

    if (prevId !== regeneratingMessageId) {
      if (regeneratingMessageId) {
        // Starting regeneration - capture original length
        const messageIndex = messages.findIndex(
          (m) => m.id === regeneratingMessageId,
        )
        if (messageIndex !== -1) {
          regenerationOriginalLengthRef.current = getMessageText(
            messages[messageIndex],
          ).length
        }
      } else {
        // Completed regeneration - reset
        regenerationOriginalLengthRef.current = 0
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regeneratingMessageId, messages])

  // Load more when scrolling to top
  const handleScroll = useCallback(() => {
    if (!parentRef.current || !onLoadMore || !hasMore) return

    const { scrollTop } = parentRef.current
    if (scrollTop < 100) {
      onLoadMore()
    }
  }, [onLoadMore, hasMore])

  const captureScrollAnchor = useCallback(() => {
    const element = parentRef.current
    if (!element) return
    const virtualItems = rowVirtualizer.getVirtualItems()
    if (virtualItems.length === 0) return
    const firstItem = virtualItems[0]
    const message = messages[firstItem.index]
    if (!message) return
    scrollAnchorRef.current = {
      messageId: message.id,
      offset: element.scrollTop - firstItem.start,
    }
  }, [messages, rowVirtualizer])

  const updateScrollIndicator = useCallback(() => {
    const element = parentRef.current
    if (!element) return
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight
    const overflow = element.scrollHeight - element.clientHeight
    if (overflow <= 0) {
      setShowScrollToBottom(false)
      return
    }
    setShowScrollToBottom(distanceFromBottom > 240)
  }, [])

  const scrollToBottom = useCallback(() => {
    const element = parentRef.current
    if (!element) return
    autoScrollEnabledRef.current = true
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const element = parentRef.current
    if (!element) return

    const handleScrollEvent = () => {
      handleScroll()
      updateScrollIndicator()
      const element = parentRef.current
      if (!element) return
      const distanceFromBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight
      autoScrollEnabledRef.current = distanceFromBottom <= 4
      if (!autoScrollEnabledRef.current) {
        captureScrollAnchor()
      }
    }

    element.addEventListener('scroll', handleScrollEvent, { passive: true })
    updateScrollIndicator()
    return () => element.removeEventListener('scroll', handleScrollEvent)
  }, [handleScroll, updateScrollIndicator, captureScrollAnchor])

  useEffect(() => {
    updateScrollIndicator()
    if (!autoScrollEnabledRef.current) {
      captureScrollAnchor()
    }
  }, [
    messages,
    regeneratingMessageId,
    totalSize,
    updateScrollIndicator,
    captureScrollAnchor,
  ])

  useEffect(() => {
    const wasStreaming = wasStreamingRef.current
    wasStreamingRef.current = isStreaming
    if (!wasStreaming || isStreaming) return
    if (autoScrollEnabledRef.current) return
    const anchor = scrollAnchorRef.current
    if (!anchor) return

    const restore = () => {
      const element = parentRef.current
      if (!element) return
      const index = messages.findIndex((message) => message.id === anchor.messageId)
      if (index === -1) return
      const offsetInfo = rowVirtualizer.getOffsetForIndex(index, 'start')
      if (!offsetInfo) return
      const [offset] = offsetInfo
      element.scrollTop = offset + anchor.offset
    }

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(restore))
    } else {
      setTimeout(restore, 0)
    }
  }, [isStreaming, messages, rowVirtualizer])

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage) return
    if (lastAnimatedMessageIdRef.current === lastMessage.id) return

    lastAnimatedMessageIdRef.current = lastMessage.id
    setEnteringMessageIds((current) => {
      const next = new Set(current)
      next.add(lastMessage.id)
      return next
    })

    const timeoutId = window.setTimeout(() => {
      setEnteringMessageIds((current) => {
        const next = new Set(current)
        next.delete(lastMessage.id)
        return next
      })
      enterTimeoutsRef.current.delete(lastMessage.id)
    }, 320)

    enterTimeoutsRef.current.set(lastMessage.id, timeoutId)
  }, [messages])

  useEffect(() => {
    return () => {
      for (const timeoutId of enterTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId)
      }
      enterTimeoutsRef.current.clear()
    }
  }, [])

  // Share dialog handlers
  const openShareDialog = (
    messageId: string,
    userInput: string,
    response: string,
  ) => {
    const isAlreadyShared = sharedMessageMap?.has(messageId)
    setShareDialogMessage({ id: messageId, userInput, response })
    setShareMode(isAlreadyShared ? 'public' : 'private')
    setShareDialogOpen(true)
    setCopied(false)
  }

  const handleShareModeChange = async (mode: 'private' | 'public') => {
    if (shareMode === mode || !shareDialogMessage) return
    setShareMode(mode)
    setIsUpdatingShare(true)

    try {
      if (mode === 'public') {
        // Share the message
        if (onShareMessage) {
          await onShareMessage(
            shareDialogMessage.id,
            shareDialogMessage.userInput,
            shareDialogMessage.response,
          )
        }
      } else {
        // Unshare the message
        const shareId = sharedMessageMap?.get(shareDialogMessage.id)
        if (shareId && onUnshareMessage) {
          await onUnshareMessage(shareId)
        }
      }
    } catch (error) {
      console.error('Failed to update share status:', error)
    } finally {
      setIsUpdatingShare(false)
    }
  }

  const handleCopyShareLink = async () => {
    if (!shareDialogMessage || shareMode === 'private') return

    const shareId = sharedMessageMap?.get(shareDialogMessage.id)
    if (shareId) {
      await navigator.clipboard.writeText(
        `${window.location.origin}/s/${shareId}`,
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const selectedReasoningMessage = useMemo(() => {
    if (!reasoningMessageId) return null
    return messages.find((message) => message.id === reasoningMessageId) || null
  }, [messages, reasoningMessageId])

  if (messages.length === 0) {
    return null
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto scroll-smooth overscroll-contain relative"
    >
      <div className="w-full max-w-3xl mx-auto px-4 py-4">
        <div
          className="relative w-full"
          style={{ height: totalSize }}
        >
          {virtualItems.map((virtualRow) => {
            const isLoadingRow =
              showLoadingIndicator && virtualRow.index === messages.length
            if (isLoadingRow) {
              return (
                <div
                  key="loading"
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="flex flex-col gap-1.5 items-start">
                    <div className="text-sm">
                      <span className="text-foreground animate-pulse">●●●</span>
                    </div>
                  </div>
                </div>
              )
            }

            const message = messages[virtualRow.index]
            if (!message) return null

            const previousMessage =
              virtualRow.index > 0 ? messages[virtualRow.index - 1] : null
            const userInput = previousMessage
              ? getMessageText(previousMessage)
              : ''

            return (
              <div
                key={message.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={
                  enteringMessageIds.has(message.id)
                    ? 'chat-message-enter'
                    : undefined
                }
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ChatMessageRow
                  message={message}
                  index={virtualRow.index}
                  totalMessages={messages.length}
                  isLoading={isLoading}
                  isStreaming={isStreaming}
                  regeneratingMessageId={regeneratingMessageId}
                  regenerationOriginalLength={
                    regenerationOriginalLengthRef.current
                  }
                  modelId={modelId}
                  sharedMessageMap={sharedMessageMap}
                  reasoningSession={reasoningSessions[message.id]}
                  userInput={userInput}
                  onOpenReasoning={openReasoning}
                  onReload={onReload}
                  onOpenShareDialog={openShareDialog}
                  onEditMessage={onEditMessage}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="pointer-events-none sticky bottom-1 z-20 flex justify-center">
        {showScrollToBottom && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="pointer-events-auto shadow-md rounded-full p-1.5"
            onClick={scrollToBottom}
          >
            <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={2} />
            {/* <span className="ml-2 text-xs font-medium">Scroll to bottom</span> */}
          </Button>
        )}
      </div>

      <ShareResponseDialog
        open={shareDialogOpen}
        onOpenChange={handleShareDialogOpenChange}
        message={shareDialogMessage}
        shareMode={shareMode}
        isUpdating={isUpdatingShare}
        copied={copied}
        sharedMessageMap={sharedMessageMap}
        onShareModeChange={handleShareModeChange}
        onCopyLink={handleCopyShareLink}
      />

      <ReasoningTraceSheet
        open={reasoningOpen}
        onOpenChange={setReasoningOpen}
        message={selectedReasoningMessage}
      />
    </div>
  )
}
