import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { UIMessage } from 'ai'
import {
  ChatMessageRow,
  ShareResponseDialog,
  ReasoningTraceSheet,
  getMessageText,
  getReasoningParts,
  messageAnchorId,
  type ShareDialogMessage,
  type ReasoningSession,
} from '../messages'

interface ChatMessagesVirtualProps {
  messages: UIMessage[]
  isLoading?: boolean
  regeneratingMessageId?: string | null // ID of message being regenerated
  onLoadMore?: () => void
  hasMore?: boolean
  onReload?: (assistantMessageId: string) => void
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

  const openReasoning = useCallback((messageId: string) => {
    setReasoningMessageId(messageId)
    setReasoningOpen(true)
  }, [])

  const handleShareDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) setShareDialogOpen(false)
  }, [])

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

  // Scroll to specific message if scrollToMessageId is provided
  useEffect(() => {
    if (
      scrollToMessageId &&
      messages.length > 0 &&
      !hasScrolledToTarget.current
    ) {
      const target = document.getElementById(messageAnchorId(scrollToMessageId))
      if (!target) return
      hasScrolledToTarget.current = true
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [scrollToMessageId, messages])

  // Auto-scroll to bottom when new messages arrive (skip if we have a scroll target or regenerating)
  useEffect(() => {
    if (scrollToMessageId && !hasScrolledToTarget.current) return
    if (regeneratingMessageId) return // Don't scroll during regeneration
    if (messages.length > lastMessageCount.current) {
      lastMessageCount.current = messages.length
      const element = parentRef.current
      if (element) {
        element.scrollTo({
          top: element.scrollHeight,
          behavior: 'smooth',
        })
      }
    }
  }, [messages.length, scrollToMessageId, regeneratingMessageId])

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

  useEffect(() => {
    const element = parentRef.current
    if (!element) return

    element.addEventListener('scroll', handleScroll)
    return () => element.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

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
    <div ref={parentRef} className="flex-1 overflow-y-auto">
      <div className="w-full max-w-3xl mx-auto p-6">
        {messages.map((message, index) => {
          const previousMessage = index > 0 ? messages[index - 1] : null
          const userInput = previousMessage
            ? getMessageText(previousMessage)
            : ''
          return (
            <ChatMessageRow
              key={message.id}
              message={message}
              index={index}
              totalMessages={messages.length}
              isLoading={isLoading}
              isStreaming={isStreaming}
              regeneratingMessageId={regeneratingMessageId}
              regenerationOriginalLength={regenerationOriginalLengthRef.current}
              modelId={modelId}
              sharedMessageMap={sharedMessageMap}
              reasoningSession={reasoningSessions[message.id]}
              userInput={userInput}
              onOpenReasoning={openReasoning}
              onReload={onReload}
              onOpenShareDialog={openShareDialog}
              onEditMessage={onEditMessage}
            />
          )
        })}
        {showLoadingIndicator && (
          <div className="px-6">
            <div className="flex flex-col gap-1.5 items-start">
              <div className="text-sm">
                <span className="text-foreground animate-pulse">●●●</span>
              </div>
            </div>
          </div>
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
