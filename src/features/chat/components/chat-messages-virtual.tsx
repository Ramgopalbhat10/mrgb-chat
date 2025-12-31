import { Share01Icon, Download01Icon, Copy01Icon, Refresh01Icon, Tick01Icon, LockIcon, Globe02Icon, Loading03Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageUsageIndicator, type MessageUsage } from './message-usage'
import type { UIMessage } from 'ai'
import { cn } from '@/lib/utils'
import { Streamdown } from 'streamdown'

interface ChatMessagesVirtualProps {
  messages: UIMessage[]
  isLoading?: boolean
  regeneratingMessageId?: string | null // ID of message being regenerated
  onLoadMore?: () => void
  hasMore?: boolean
  onReload?: (assistantMessageId: string) => void
  onShareMessage?: (messageId: string, userInput: string, response: string) => Promise<string | null>
  onUnshareMessage?: (shareId: string) => Promise<boolean>
  sharedMessageMap?: Map<string, string> // originalMessageId -> shareId
  modelId?: string
  scrollToMessageId?: string
}

function getMessageText(message: UIMessage): string {
  // Handle content string (user messages from useChat)
  const msg = message as any
  if (typeof msg.content === 'string' && msg.content.length > 0) {
    return msg.content
  }

  // Handle parts array (assistant messages)
  if (message.parts && message.parts.length > 0) {
    return message.parts
      .filter(
        (part): part is { type: 'text'; text: string } => part.type === 'text',
      )
      .map((part) => part.text)
      .join('')
  }

  return ''
}

function getReasoningParts(message: UIMessage): Array<{
  type: 'reasoning'
  text: string
  state?: 'streaming' | 'done'
}> {
  if (!message.parts) return []
  return message.parts.filter(
    (part): part is { type: 'reasoning'; text: string; state?: 'streaming' | 'done' } =>
      part.type === 'reasoning',
  )
}

function getReasoningText(message: UIMessage): string {
  return getReasoningParts(message)
    .map((part) => part.text)
    .join('')
}

function formatThoughtDuration(seconds: number): string {
  if (seconds === 1) return '1 second'
  return `${seconds} seconds`
}

// Estimate message height based on content length
function estimateMessageHeight(message: UIMessage): number {
  const text = getMessageText(message)
  const isUser = message.role === 'user'

  // Base height for padding and margins
  const baseHeight = 48

  // Estimate lines based on average characters per line
  const charsPerLine = isUser ? 60 : 80
  const lines = Math.ceil(text.length / charsPerLine)

  // Height per line (including line-height)
  const lineHeight = 24

  // For code blocks, add extra height
  const codeBlockCount = (text.match(/```/g) || []).length / 2
  const codeBlockHeight = codeBlockCount * 100

  return baseHeight + lines * lineHeight + codeBlockHeight
}

function MessageAction({
  icon,
  onClick,
  tooltip,
  successIcon,
  successTooltip,
  iconClassName,
}: {
  icon: any
  onClick: () => void
  tooltip: string
  successIcon?: any
  successTooltip?: string
  iconClassName?: string
}) {
  const [showSuccess, setShowSuccess] = useState(false)

  const handleClick = () => {
    onClick()
    if (successIcon) {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    }
  }

  const currentIcon = showSuccess && successIcon ? successIcon : icon
  const currentTooltip = showSuccess && successTooltip ? successTooltip : tooltip

  return (
    <Tooltip>
      <TooltipTrigger render={
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 transition-all duration-200",
            showSuccess
              ? "text-emerald-500 hover:text-emerald-400"
              : iconClassName || "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
          onClick={handleClick}
        >
          <HugeiconsIcon icon={currentIcon} size={15} strokeWidth={2} />
        </Button>
      } />
      <TooltipContent side="bottom" sideOffset={4}>
        {currentTooltip}
      </TooltipContent>
    </Tooltip>
  )
}

// Extract usage from UIMessage metadata (AI SDK v5 uses message.metadata)
interface MessageMeta {
  usage?: MessageUsage
  modelId?: string
}

function getMessageMeta(message: UIMessage): MessageMeta | undefined {
  const msg = message as any

  // AI SDK v5: Usage data is in message.metadata (set via messageMetadata callback)
  if (msg.metadata?.usage) {
    const usage: MessageUsage = {
      inputTokens: msg.metadata.usage.inputTokens,
      outputTokens: msg.metadata.usage.outputTokens,
      totalTokens: msg.metadata.usage.totalTokens,
      reasoningTokens: msg.metadata.usage.reasoningTokens,
    }

    // Gateway cost is included directly in metadata
    if (msg.metadata.gatewayCost) {
      usage.gatewayCost = msg.metadata.gatewayCost
    }

    return {
      usage,
      modelId: msg.metadata.model, // Model ID from API response
    }
  }

  return undefined
}

export function ChatMessagesVirtual({
  messages,
  isLoading,
  regeneratingMessageId,
  onLoadMore,
  hasMore,
  onReload,
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
  const [reasoningMessageId, setReasoningMessageId] = useState<string | null>(null)
  const reasoningSessionsRef = useRef<Record<string, { startedAt: number; endedAt?: number }>>({})

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareDialogMessage, setShareDialogMessage] = useState<{ id: string; userInput: string; response: string } | null>(null)
  const [shareMode, setShareMode] = useState<'private' | 'public'>('private')
  const [isUpdatingShare, setIsUpdatingShare] = useState(false)
  const [copied, setCopied] = useState(false)

  const openReasoning = useCallback((messageId: string) => {
    setReasoningMessageId(messageId)
    setReasoningOpen(true)
  }, [])

  const handleReasoningOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) setReasoningOpen(false)
  }, [])

  const handleShareDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) setShareDialogOpen(false)
  }, [])

  const lastMessage = messages[messages.length - 1]
  // Streaming when: normal loading with assistant message OR regenerating any message
  const isStreaming = (isLoading && lastMessage?.role === 'assistant') || !!regeneratingMessageId

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
      if (isComplete && sessions[message.id] && sessions[message.id].startedAt > 0 && !sessions[message.id].endedAt) {
        sessions[message.id].endedAt = now
      }
    }

    return sessions
  }, [messages, regeneratingMessageId])

  // Add loading indicator as virtual item if needed (only for new messages, not regeneration)
  const showLoadingIndicator = isLoading && lastMessage?.role === 'user' && !regeneratingMessageId
  const itemCount = messages.length + (showLoadingIndicator ? 1 : 0)

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      if (index >= messages.length) {
        return 48 // Loading indicator height
      }
      // Return small height for the message being regenerated (loading dots)
      if (regeneratingMessageId === messages[index].id) {
        return 72 // Height for loading dots state
      }
      return estimateMessageHeight(messages[index])
    },
    overscan: 5,
  })

  // Scroll to specific message if scrollToMessageId is provided
  useEffect(() => {
    if (scrollToMessageId && messages.length > 0 && !hasScrolledToTarget.current) {
      const messageIndex = messages.findIndex(m => m.id === scrollToMessageId)
      if (messageIndex !== -1) {
        hasScrolledToTarget.current = true
        // Delay to ensure virtualizer is ready after messages load
        setTimeout(() => {
          virtualizer.scrollToIndex(messageIndex, { align: 'start', behavior: 'smooth' })
        }, 300)
      }
    }
  }, [scrollToMessageId, messages])

  // Auto-scroll to bottom when new messages arrive (skip if we have a scroll target or regenerating)
  useEffect(() => {
    if (scrollToMessageId && !hasScrolledToTarget.current) return
    if (regeneratingMessageId) return // Don't scroll during regeneration
    if (messages.length > lastMessageCount.current) {
      lastMessageCount.current = messages.length
      virtualizer.scrollToIndex(itemCount - 1, { align: 'end', behavior: 'smooth' })
    }
  }, [messages.length, itemCount, scrollToMessageId, regeneratingMessageId])

  // Note: Removed auto-scroll during streaming as it caused issues during regeneration.
  // Users can manually scroll if needed. Scroll only happens for NEW messages (above effect).

  // Force virtualizer to remeasure when regeneration state changes
  useEffect(() => {
    const prevId = prevRegeneratingMessageIdRef.current
    prevRegeneratingMessageIdRef.current = regeneratingMessageId ?? null

    // Regeneration started or completed - force remeasure
    if (prevId !== regeneratingMessageId) {
      if (regeneratingMessageId) {
        // Starting regeneration - capture original length
        const messageIndex = messages.findIndex(m => m.id === regeneratingMessageId)
        if (messageIndex !== -1) {
          regenerationOriginalLengthRef.current = getMessageText(messages[messageIndex]).length
        }
      } else {
        // Completed regeneration - reset
        regenerationOriginalLengthRef.current = 0
      }
      // Delay remeasure to let React update DOM first
      setTimeout(() => {
        virtualizer.measure()
      }, 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regeneratingMessageId])

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
  const openShareDialog = (messageId: string, userInput: string, response: string) => {
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
          await onShareMessage(shareDialogMessage.id, shareDialogMessage.userInput, shareDialogMessage.response)
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
      await navigator.clipboard.writeText(`${window.location.origin}/s/${shareId}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const selectedReasoningMessage = useMemo(() => {
    if (!reasoningMessageId) return null
    return messages.find((message) => message.id === reasoningMessageId) || null
  }, [messages, reasoningMessageId])

  const selectedReasoningParts = useMemo(
    () => (selectedReasoningMessage ? getReasoningParts(selectedReasoningMessage) : []),
    [selectedReasoningMessage],
  )

  const selectedReasoningText = useMemo(
    () => (selectedReasoningMessage ? getReasoningText(selectedReasoningMessage) : ''),
    [selectedReasoningMessage],
  )

  // Group reasoning text into logical blocks, keeping headers with their content
  const selectedReasoningBlocks = useMemo(() => {
    const lines = selectedReasoningText.split('\n')
    const blocks: string[] = []
    let currentBlock: string[] = []

    for (const line of lines) {
      const trimmedLine = line.trim()
      // Check if line is a header (starts with ** or #)
      const isHeader = /^(\*\*|#{1,6}\s)/.test(trimmedLine)

      if (isHeader && currentBlock.length > 0) {
        // If we hit a new header and have content, save current block first
        const blockText = currentBlock.join('\n').trim()
        if (blockText) blocks.push(blockText)
        currentBlock = [line]
      } else if (trimmedLine === '' && currentBlock.length > 0) {
        // Empty line - check if next content starts with header
        // For now, just add to current block to maintain spacing
        currentBlock.push(line)
      } else {
        currentBlock.push(line)
      }
    }

    // Don't forget the last block
    const lastBlockText = currentBlock.join('\n').trim()
    if (lastBlockText) blocks.push(lastBlockText)

    return blocks
  }, [selectedReasoningText])

  const selectedReasoningSession = reasoningMessageId
    ? reasoningSessions[reasoningMessageId]
    : undefined
  const selectedDurationSeconds =
    selectedReasoningSession?.endedAt && selectedReasoningSession.startedAt
      ? Math.max(
        1,
        Math.round(
          (selectedReasoningSession.endedAt - selectedReasoningSession.startedAt) / 1000,
        ),
      )
      : null
  const selectedDurationLabel = selectedDurationSeconds
    ? formatThoughtDuration(selectedDurationSeconds)
    : null
  const selectedReasoningStreaming = selectedReasoningParts.some(
    (part) => part.state === 'streaming',
  )

  if (messages.length === 0) {
    return null
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto"
    >
      {/* During regeneration, use normal flow layout instead of virtualization to avoid height calculation issues */}
      {regeneratingMessageId ? (
        <div className="w-full max-w-3xl mx-auto p-6">
          {messages.map((message, index) => {
            const text = getMessageText(message)
            const isUser = message.role === 'user'
            const isLastAssistant = index === messages.length - 1 && !isUser
            const reasoningParts = getReasoningParts(message)
            const hasReasoning = reasoningParts.length > 0
            const reasoningSession = reasoningSessions[message.id]
            const reasoningDurationSeconds =
              reasoningSession?.endedAt && reasoningSession.startedAt
                ? Math.max(1, Math.round((reasoningSession.endedAt - reasoningSession.startedAt) / 1000))
                : null
            const reasoningDurationLabel = reasoningDurationSeconds
              ? formatThoughtDuration(reasoningDurationSeconds)
              : null
            const isReasoningStreaming = reasoningParts.some((part) => part.state === 'streaming')
            const isBeingRegenerated = regeneratingMessageId === message.id
            const hasNewStreamingContent = isBeingRegenerated
              ? (text.length !== regenerationOriginalLengthRef.current || isReasoningStreaming)
              : false
            const showRegenerationLoading = isBeingRegenerated && !hasNewStreamingContent

            return (
              <div key={message.id} className="px-6">
                <div className={cn('flex flex-col gap-1.5 py-3 group', isUser ? 'items-end' : 'items-start')}>
                  <div
                    className={cn(
                      'rounded-md text-sm leading-relaxed',
                      isUser ? 'bg-secondary px-3 py-2 text-foreground border border-secondary max-w-[85%]' : 'text-foreground w-full',
                    )}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{text}</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {hasReasoning && !showRegenerationLoading && (
                          <button
                            type="button"
                            onClick={() => openReasoning(message.id)}
                            title="View reasoning"
                            className="group inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <HugeiconsIcon icon={Loading03Icon} size={14} strokeWidth={2} className={cn('text-muted-foreground/60', isReasoningStreaming && 'animate-spin')} />
                            {isReasoningStreaming ? <span className="animate-pulse">Thinking</span> : <span>Thought for {reasoningDurationLabel ?? 'a moment'}</span>}
                          </button>
                        )}
                        {showRegenerationLoading ? (
                          <div className="text-sm py-2"><span className="text-foreground animate-pulse">●●●</span></div>
                        ) : (
                          <div className={cn('prose prose-sm prose-invert max-w-none', (isLastAssistant || isBeingRegenerated) && isStreaming && '**:animate-in **:fade-in **:duration-150')}>
                            <Streamdown>{text}</Streamdown>
                          </div>
                        )}
                        {!isBeingRegenerated && (
                          <div className="flex items-center gap-0.5">
                            <MessageUsageIndicator usage={getMessageMeta(message)?.usage} modelId={getMessageMeta(message)?.modelId || modelId} />
                            <MessageAction icon={Copy01Icon} successIcon={Tick01Icon} successTooltip="Copied!" onClick={() => navigator.clipboard.writeText(text)} tooltip="Copy" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Normal virtualized rendering when NOT regenerating */
        <div
          className="relative w-full max-w-3xl mx-auto"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          <div className="p-6">
            {virtualizer.getVirtualItems().map((virtualItem) => {
              // Loading indicator
              if (virtualItem.index >= messages.length) {
                return (
                  <div
                    key="loading"
                    className="absolute top-0 left-0 w-full px-6"
                    style={{
                      transform: `translateY(${virtualItem.start}px)`,
                      height: `${virtualItem.size}px`,
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

              const message = messages[virtualItem.index]
              const text = getMessageText(message)
              const isUser = message.role === 'user'
              const isLastAssistant =
                virtualItem.index === messages.length - 1 && !isUser
              const reasoningParts = getReasoningParts(message)
              const hasReasoning = reasoningParts.length > 0
              const reasoningSession = reasoningSessions[message.id]
              const reasoningDurationSeconds =
                reasoningSession?.endedAt && reasoningSession.startedAt
                  ? Math.max(
                    1,
                    Math.round(
                      (reasoningSession.endedAt - reasoningSession.startedAt) / 1000,
                    ),
                  )
                  : null
              const reasoningDurationLabel = reasoningDurationSeconds
                ? formatThoughtDuration(reasoningDurationSeconds)
                : null
              const isReasoningStreaming = reasoningParts.some(
                (part) => part.state === 'streaming',
              )

              // Determine if this message is being regenerated
              const isBeingRegenerated = regeneratingMessageId === message.id

              // During regeneration: show loading if no NEW content has arrived yet
              // New content is detected when text length differs from captured original OR reasoning is streaming
              const hasNewStreamingContent = isBeingRegenerated
                ? (text.length !== regenerationOriginalLengthRef.current || isReasoningStreaming)
                : false
              const showRegenerationLoading = isBeingRegenerated && !hasNewStreamingContent

              return (
                <div
                  key={message.id}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full px-6"
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div
                    className={cn(
                      'flex flex-col gap-1.5 py-3 group',
                      isUser ? 'items-end' : 'items-start',
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-md text-sm leading-relaxed',
                        isUser
                          ? 'bg-secondary px-3 py-2 text-foreground border border-secondary max-w-[85%]'
                          : 'text-foreground w-full',
                      )}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{text}</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {/* Show reasoning button when message has reasoning (hide only when showing regeneration loading dots) */}
                          {hasReasoning && !showRegenerationLoading && (
                            <button
                              type="button"
                              onClick={() => openReasoning(message.id)}
                              title="View reasoning"
                              className="group inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <HugeiconsIcon
                                icon={Loading03Icon}
                                size={14}
                                strokeWidth={2}
                                className={cn(
                                  'text-muted-foreground/60 transition-colors group-hover:text-foreground',
                                  isReasoningStreaming && 'animate-spin',
                                )}
                              />
                              {isReasoningStreaming ? (
                                <span className="bg-linear-to-r from-foreground/40 via-foreground/90 to-foreground/40 bg-size-[200%_100%] bg-clip-text text-transparent animate-pulse">
                                  Thinking
                                </span>
                              ) : (
                                <span>
                                  Thought for {reasoningDurationLabel ?? 'a moment'}
                                </span>
                              )}
                            </button>
                          )}
                          {/* Show loading dots when regenerating and no new content yet */}
                          {showRegenerationLoading ? (
                            <div className="text-sm py-2">
                              <span className="text-foreground animate-pulse">●●●</span>
                            </div>
                          ) : (
                            <div
                              className={cn(
                                'prose prose-sm prose-invert max-w-none',
                                (isLastAssistant || isBeingRegenerated) &&
                                isStreaming &&
                                '**:animate-in **:fade-in **:duration-150',
                              )}
                            >
                              <Streamdown>{text}</Streamdown>
                            </div>
                          )}
                          {/* Show action icons for completed messages - hide only for the message currently being streamed */}
                          {/* During regeneration: hide only for isBeingRegenerated. During new streaming: hide only for isLastAssistant when isLoading */}
                          {!(isBeingRegenerated || (isLoading && isLastAssistant && !regeneratingMessageId)) && (
                            <div className="flex items-center gap-0.5">
                              {(() => {
                                const meta = getMessageMeta(message)
                                return (
                                  <MessageUsageIndicator
                                    usage={meta?.usage}
                                    modelId={meta?.modelId || modelId}
                                  />
                                )
                              })()}
                              <MessageAction
                                icon={Copy01Icon}
                                successIcon={Tick01Icon}
                                successTooltip="Copied!"
                                onClick={() => navigator.clipboard.writeText(text)}
                                tooltip="Copy"
                              />
                              <MessageAction
                                icon={Download01Icon}
                                successIcon={Tick01Icon}
                                successTooltip="Downloaded!"
                                onClick={() => {
                                  const blob = new Blob([text], { type: 'text/markdown' })
                                  const url = URL.createObjectURL(blob)
                                  const a = document.createElement('a')
                                  a.href = url
                                  a.download = `chat-${message.id.slice(0, 8)}.md`
                                  document.body.appendChild(a)
                                  a.click()
                                  document.body.removeChild(a)
                                  URL.revokeObjectURL(url)
                                }}
                                tooltip="Download"
                              />
                              <MessageAction
                                icon={Refresh01Icon}
                                onClick={() => onReload?.(message.id)}
                                tooltip="Regenerate"
                              />
                              <MessageAction
                                icon={sharedMessageMap?.has(message.id) ? Globe02Icon : Share01Icon}
                                iconClassName={sharedMessageMap?.has(message.id) ? "text-emerald-500 hover:text-emerald-400" : undefined}
                                onClick={() => {
                                  // Find the user message before this assistant message
                                  const msgIndex = messages.findIndex(m => m.id === message.id)
                                  const userMessage = msgIndex > 0 ? messages[msgIndex - 1] : null
                                  const userInput = userMessage ? getMessageText(userMessage) : ''
                                  openShareDialog(message.id, userInput, text)
                                }}
                                tooltip={sharedMessageMap?.has(message.id) ? "Manage share" : "Share"}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={handleShareDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share response</DialogTitle>
            <DialogDescription>
              Share this response publicly with a link.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {/* Private option */}
            <button
              onClick={() => handleShareModeChange('private')}
              disabled={isUpdatingShare}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${shareMode === 'private'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-accent/50'
                } disabled:opacity-50`}
            >
              <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                <HugeiconsIcon icon={LockIcon} size={18} strokeWidth={2} className="text-muted-foreground" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">Private</div>
                <div className="text-xs text-muted-foreground">Only you have access</div>
              </div>
              {shareMode === 'private' && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>

            {/* Public option */}
            <button
              onClick={() => handleShareModeChange('public')}
              disabled={isUpdatingShare}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${shareMode === 'public'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-accent/50'
                } disabled:opacity-50`}
            >
              <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                <HugeiconsIcon icon={Globe02Icon} size={18} strokeWidth={2} className="text-muted-foreground" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">Public access</div>
                <div className="text-xs text-muted-foreground">Anyone with the link can view</div>
              </div>
              {shareMode === 'public' && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  {isUpdatingShare ? (
                    <HugeiconsIcon icon={Loading03Icon} size={12} strokeWidth={2} className="text-primary-foreground animate-spin" />
                  ) : (
                    <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              )}
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Don't share personal information or third-party content without permission.
          </p>

          <DialogFooter>
            <Button
              onClick={handleCopyShareLink}
              disabled={shareMode === 'private' || isUpdatingShare || !sharedMessageMap?.has(shareDialogMessage?.id || '')}
              className="w-full sm:w-auto"
            >
              {copied ? (
                <>
                  <HugeiconsIcon icon={Tick01Icon} size={16} strokeWidth={2} className="mr-1.5" />
                  Copied!
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Copy01Icon} size={16} strokeWidth={2} className="mr-1.5" />
                  Copy share link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={reasoningOpen} onOpenChange={setReasoningOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col overflow-hidden">
          <SheetHeader className="pb-2">
            <SheetTitle>
              {selectedReasoningStreaming
                ? 'Thinking'
                : selectedDurationLabel
                  ? `Thought for ${selectedDurationLabel}`
                  : 'Thoughts'}
            </SheetTitle>
            <SheetDescription>
              {selectedReasoningStreaming
                ? 'Live reasoning stream'
                : 'Reasoning trace'}
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <ScrollArea className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
            {selectedReasoningBlocks.length > 0 ? (
              <div className="flex flex-col gap-4 py-4">
                {selectedReasoningBlocks.map((block, index) => {
                  const isLast = index === selectedReasoningBlocks.length - 1
                  return (
                    <div
                      key={`${index}-${block.slice(0, 16)}`}
                      className="flex gap-3"
                    >
                      <div className="flex flex-col items-center pt-1">
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            isLast && selectedReasoningStreaming
                              ? 'bg-primary/80 animate-pulse'
                              : 'bg-muted-foreground/60',
                          )}
                        />
                        {!isLast && (
                          <span className="mt-2 w-px flex-1 bg-border/60" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Step {index + 1}
                        </div>
                        <div className="prose prose-sm prose-invert max-w-none">
                          <Streamdown>{block}</Streamdown>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-4 text-sm text-muted-foreground">
                {selectedReasoningStreaming ? (
                  <span className="bg-linear-to-r from-foreground/40 via-foreground/90 to-foreground/40 bg-size-[200%_100%] bg-clip-text text-transparent animate-pulse">
                    Thinking...
                  </span>
                ) : (
                  'No reasoning captured yet.'
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}
