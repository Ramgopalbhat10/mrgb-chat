import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import {
  ChatMessageRow,
  
  ReasoningTraceSheet,
  
  ShareResponseDialog,
  getMessageText,
  getReasoningParts
} from '../messages'
import { ChatSuggestions, ChatSuggestionsSkeleton } from './chat-suggestions'
import type { VirtualItem, Virtualizer } from '@tanstack/virtual-core'
import type { UIMessage } from 'ai'
import type { RegenerationOptions } from '@/features/chat/types/regeneration'
import type {ReasoningSession, ShareDialogMessage} from '../messages';
import { Button } from '@/components/ui/button'

interface ChatMessagesVirtualProps {
  messages: Array<UIMessage>
  isLoading?: boolean
  regeneratingMessageId?: string | null // ID of message being regenerated
  suggestions?: Array<string>
  suggestionsLoading?: boolean
  onSelectSuggestion?: (suggestion: string) => void
  onLoadMore?: () => void
  hasMore?: boolean
  onReload?: (assistantMessageId: string, options?: RegenerationOptions) => void
  onBranchFromAssistant?: (assistantMessageId: string) => void
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
  branchInfo?: { id: string; title: string; anchorMessageId: string } | null
}

export function ChatMessagesVirtual({
  messages,
  isLoading,
  regeneratingMessageId,
  suggestions,
  suggestionsLoading,
  onSelectSuggestion,
  onLoadMore,
  hasMore,
  onReload,
  onBranchFromAssistant,
  onEditMessage,
  onShareMessage,
  onUnshareMessage,
  sharedMessageMap,
  modelId,
  scrollToMessageId,
  branchInfo,
}: ChatMessagesVirtualProps) {
  type BranchInfo = NonNullable<ChatMessagesVirtualProps['branchInfo']>
  type Row =
    | { type: 'message'; message: UIMessage; messageIndex: number }
    | { type: 'branch'; branchInfo: BranchInfo }
    | { type: 'loading' }
    | { type: 'suggestions' }
  const parentRef = useRef<HTMLDivElement>(null)
  const lastMessageCount = useRef(messages.length)
  const hasScrolledToTarget = useRef(false)
  const prevRegeneratingMessageIdRef = useRef<string | null>(null)
  const autoScrollEnabledRef = useRef(true)
  const scrollAnchorRef = useRef<{
    rowKey: string
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

  const showSuggestions =
    !!suggestionsLoading || (suggestions && suggestions.length > 0)
  const branchAnchorIndex = useMemo(() => {
    if (!branchInfo?.anchorMessageId) return null
    const index = messages.findIndex(
      (message) => message.id === branchInfo.anchorMessageId,
    )
    return index >= 0 ? index : null
  }, [branchInfo?.anchorMessageId, messages])

  const rows = useMemo<Array<Row>>(() => {
    const base: Array<Row> = messages.map((message, messageIndex) => ({
      type: 'message',
      message,
      messageIndex,
    }))

    if (branchAnchorIndex !== null && branchInfo) {
      base.splice(branchAnchorIndex + 1, 0, {
        type: 'branch',
        branchInfo,
      })
    }

    if (showLoadingIndicator) {
      base.push({ type: 'loading' })
    }

    if (showSuggestions) {
      base.push({ type: 'suggestions' })
    }

    return base
  }, [branchAnchorIndex, branchInfo, messages, showLoadingIndicator, showSuggestions])

  const getRowKey = useCallback((row: Row | undefined, index: number) => {
    if (!row) return `missing:${index}`
    if (row.type === 'message') return `message:${row.message.id}`
    if (row.type === 'branch') {
      return `branch:${row.branchInfo.id}:${row.branchInfo.anchorMessageId}`
    }
    return row.type
  }, [])

  const findMessageRowIndex = useCallback(
    (messageId: string) =>
      rows.findIndex(
        (row) => row.type === 'message' && row.message.id === messageId,
      ),
    [rows],
  )

  const totalCount = rows.length
  const stableGetScrollElement = useCallback(
    () => parentRef.current,
    [],
  )
  const stableGetItemKey = useCallback(
    (index: number) => getRowKey(rows[index], index),
    [getRowKey, rows],
  )
  const stableEstimateSize = useCallback(() => 140, [])
  const rowVirtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: stableGetScrollElement,
    getItemKey: stableGetItemKey,
    estimateSize: stableEstimateSize,
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

  const scrollToMessageIndex = useCallback(
    (index: number) => {
      const element = parentRef.current
      if (!element) return
      const offsetInfo = rowVirtualizer.getOffsetForIndex(index, 'start')
      if (offsetInfo) {
        const [offset] = offsetInfo
        element.scrollTo({ top: offset, behavior: 'smooth' })
        return
      }
      rowVirtualizer.scrollToIndex(index, { align: 'start' })
    },
    [rowVirtualizer],
  )

  // Scroll to specific message if scrollToMessageId is provided
  useEffect(() => {
    if (!scrollToMessageId || messages.length === 0) return
    if (hasScrolledToTarget.current) return
    const targetIndex = findMessageRowIndex(scrollToMessageId)
    if (targetIndex === -1) return
    hasScrolledToTarget.current = true
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => scrollToMessageIndex(targetIndex))
    } else {
      scrollToMessageIndex(targetIndex)
    }
  }, [findMessageRowIndex, messages.length, scrollToMessageId, scrollToMessageIndex])

  // Auto-scroll to bottom when new messages arrive (skip if we have a scroll target or regenerating)
  useEffect(() => {
    if (scrollToMessageId && !hasScrolledToTarget.current) return
    if (regeneratingMessageId) return // Don't scroll during regeneration
    const previousMessageCount = lastMessageCount.current
    lastMessageCount.current = messages.length
    if (messages.length <= previousMessageCount) return

    if (autoScrollEnabledRef.current) {
      rowVirtualizer.scrollToIndex(totalCount - 1, { align: 'end' })
    }
  }, [
    messages.length,
    regeneratingMessageId,
    rowVirtualizer,
    scrollToMessageId,
    totalCount,
  ])

  useEffect(() => {
    if (!showSuggestions) return
    if (!autoScrollEnabledRef.current) return
    rowVirtualizer.scrollToIndex(totalCount - 1, { align: 'end' })
  }, [rowVirtualizer, showSuggestions, totalCount])

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
    const currentVirtualItems = rowVirtualizer.getVirtualItems()
    if (currentVirtualItems.length === 0) return
    const firstItem =
      currentVirtualItems.find((item) => rows[item.index]?.type === 'message') ??
      currentVirtualItems[0]
    const rowKey = getRowKey(rows[firstItem.index], firstItem.index)
    scrollAnchorRef.current = {
      rowKey,
      offset: element.scrollTop - firstItem.start,
    }
  }, [getRowKey, rows, rowVirtualizer])

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
      const scrollElement = parentRef.current
      if (!scrollElement) return
      const distanceFromBottom =
        scrollElement.scrollHeight -
        scrollElement.scrollTop -
        scrollElement.clientHeight
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
      const index = rows.findIndex(
        (row, rowIndex) => getRowKey(row, rowIndex) === anchor.rowKey,
      )
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
  }, [getRowKey, isStreaming, rows, rowVirtualizer])

  useEffect(() => {
    if (!isStreaming) return
    if (typeof requestAnimationFrame !== 'function') return

    const measureStreamingRows = () => {
      const element = parentRef.current
      if (!element) return

      const activeRows = element.querySelectorAll<HTMLElement>(
        '[data-active-stream-row="true"]',
      )
      activeRows.forEach((rowElement) => {
        rowVirtualizer.measureElement(rowElement)
      })

      if (activeRows.length > 0 && autoScrollEnabledRef.current) {
        element.scrollTop = element.scrollHeight
      }
    }

    const frameId = requestAnimationFrame(measureStreamingRows)
    const delayedFrameId = window.setTimeout(() => {
      requestAnimationFrame(measureStreamingRows)
    }, 120)

    return () => {
      cancelAnimationFrame(frameId)
      window.clearTimeout(delayedFrameId)
    }
  }, [isStreaming, messages, reasoningSessions, rowVirtualizer])

  useEffect(() => {
    const latestMessage = messages[messages.length - 1]
    if (!latestMessage) return
    if (lastAnimatedMessageIdRef.current === latestMessage.id) return

    lastAnimatedMessageIdRef.current = latestMessage.id
    setEnteringMessageIds((current) => {
      const next = new Set(current)
      next.add(latestMessage.id)
      return next
    })

    const timeoutId = window.setTimeout(() => {
      setEnteringMessageIds((current) => {
        const next = new Set(current)
        next.delete(latestMessage.id)
        return next
      })
      enterTimeoutsRef.current.delete(latestMessage.id)
    }, 320)

    enterTimeoutsRef.current.set(latestMessage.id, timeoutId)
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
      className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth"
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <div
          className="relative w-full"
          style={{ height: totalSize }}
        >
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null

            if (row.type === 'branch') {
              return (
                <div
                  key="branch-footer"
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
                  <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground/70">
                    <div className="h-px flex-1 bg-border/60" />
                    <span className="whitespace-nowrap">
                      Branched from{' '}
                      <a
                        href={`/chat/${row.branchInfo.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                      >
                        {row.branchInfo.title}
                      </a>
                    </span>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
                </div>
              )
            }

            if (row.type === 'loading') {
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

            if (row.type === 'suggestions') {
              return (
                <div
                  key="suggestions"
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
                  {suggestionsLoading ? (
                    <ChatSuggestionsSkeleton />
                  ) : (
                    <ChatSuggestions
                      suggestions={suggestions ?? []}
                      onSelect={onSelectSuggestion}
                    />
                  )}
                </div>
              )
            }

            const message = row.message
            if (!message) return null
            const isActiveStreamingMessage =
              message.role === 'assistant' &&
              (regeneratingMessageId === message.id ||
                (isStreaming && lastMessage?.id === message.id))

            const previousMessage =
              row.messageIndex > 0 ? messages[row.messageIndex - 1] : null
            const userInput = previousMessage
              ? getMessageText(previousMessage)
              : ''

            return (
              <div
                key={message.id}
                data-index={virtualRow.index}
                data-active-stream-row={isActiveStreamingMessage || undefined}
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
                  index={row.messageIndex}
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
                  onBranchFromAssistant={onBranchFromAssistant}
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
