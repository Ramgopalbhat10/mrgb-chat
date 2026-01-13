import {
  Share01Icon,
  Download01Icon,
  Copy01Icon,
  Refresh01Icon,
  Tick01Icon,
  Globe02Icon,
  Loading03Icon,
  ArrowDown01Icon,
  PencilEdit01Icon,
  Cancel01Icon,
  SentIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MessageUsageIndicator } from '../message-usage'
import { cn } from '@/lib/utils'
import { Streamdown } from 'streamdown'
import { CollapsibleCodeBlocks } from '@/components/collapsible-code-blocks'
import type { UIMessage } from 'ai'
import {
  formatThoughtDuration,
  getMessageMeta,
  getMessageText,
  getReasoningParts,
  messageAnchorId,
  type ReasoningSession,
} from '../utils/chat-message-utils'

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
  const currentTooltip =
    showSuccess && successTooltip ? successTooltip : tooltip

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 transition-all duration-200',
              showSuccess
                ? 'text-emerald-500 hover:text-emerald-400'
                : iconClassName ||
                    'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
            onClick={handleClick}
          >
            <HugeiconsIcon icon={currentIcon} size={15} strokeWidth={2} />
          </Button>
        }
      />
      <TooltipContent side="bottom" sideOffset={4}>
        {currentTooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export interface ChatMessageRowProps {
  message: UIMessage
  index: number
  totalMessages: number
  isLoading?: boolean
  isStreaming: boolean
  regeneratingMessageId?: string | null
  regenerationOriginalLength: number
  modelId?: string
  sharedMessageMap?: Map<string, string>
  reasoningSession?: ReasoningSession
  userInput: string
  onOpenReasoning: (messageId: string) => void
  onReload?: (assistantMessageId: string) => void
  onOpenShareDialog: (
    messageId: string,
    userInput: string,
    response: string,
  ) => void
  onEditMessage?: (messageId: string, newContent: string) => void
}

export function ChatMessageRow({
  message,
  index,
  totalMessages,
  isLoading,
  isStreaming,
  regeneratingMessageId,
  regenerationOriginalLength,
  modelId,
  sharedMessageMap,
  reasoningSession,
  userInput,
  onOpenReasoning,
  onReload,
  onOpenShareDialog,
  onEditMessage,
}: ChatMessageRowProps) {
  const text = getMessageText(message)
  const isUser = message.role === 'user'
  const isLastAssistant = index === totalMessages - 1 && !isUser
  const reasoningParts = getReasoningParts(message)
  const hasReasoning = reasoningParts.length > 0
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
  const isBeingRegenerated = regeneratingMessageId === message.id
  const hasNewStreamingContent = isBeingRegenerated
    ? text.length !== regenerationOriginalLength || isReasoningStreaming
    : false
  const showRegenerationLoading = isBeingRegenerated && !hasNewStreamingContent
  const hideActions =
    isBeingRegenerated ||
    (isLoading && isLastAssistant && !regeneratingMessageId)
  const meta = getMessageMeta(message)

  // User message state
  const [isUserMessageExpanded, setIsUserMessageExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const userMessageRef = useRef<HTMLDivElement>(null)
  const messageContainerRef = useRef<HTMLDivElement>(null)
  const [needsCollapse, setNeedsCollapse] = useState(false)
  const [editWidth, setEditWidth] = useState<number | null>(null)

  const USER_MESSAGE_COLLAPSED_HEIGHT = 120 // pixels

  // Check if user message needs collapse
  useEffect(() => {
    if (isUser && userMessageRef.current) {
      const checkHeight = () => {
        const el = userMessageRef.current
        if (el) {
          setNeedsCollapse(el.scrollHeight > USER_MESSAGE_COLLAPSED_HEIGHT + 20)
        }
      }
      checkHeight()
      // Recheck after fonts load
      const timeout = setTimeout(checkHeight, 100)
      return () => clearTimeout(timeout)
    }
  }, [isUser, text])

  // Auto-resize textarea when editing
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      textareaRef.current.focus()
      // Move cursor to end
      textareaRef.current.setSelectionRange(editText.length, editText.length)
    }
  }, [isEditing, editText])

  const handleEditCancel = () => {
    setIsEditing(false)
    setEditText(text)
  }

  const handleEditSend = () => {
    setIsEditing(false)
    onEditMessage?.(message.id, editText)
  }

  return (
    <div id={messageAnchorId(message.id)} className="px-6">
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
          ref={isUser ? messageContainerRef : undefined}
          style={isUser && isEditing && editWidth ? { width: editWidth } : undefined}
        >
          {isUser ? (
            isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={textareaRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed text-foreground placeholder:text-muted-foreground"
                  placeholder="Edit your message..."
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleEditSend()
                    }
                    if (e.key === 'Escape') {
                      handleEditCancel()
                    }
                  }}
                />
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEditCancel}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="default"
                    size="icon"
                    onClick={handleEditSend}
                    className="h-7 w-7"
                  >
                    <HugeiconsIcon icon={SentIcon} size={14} strokeWidth={2} />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div
                  ref={userMessageRef}
                  className={cn(
                    'whitespace-pre-wrap overflow-hidden transition-all duration-200',
                    needsCollapse && !isUserMessageExpanded && 'max-h-[120px]',
                  )}
                >
                  {text}
                </div>
                {needsCollapse && !isUserMessageExpanded && (
                  <div className="absolute bottom-0 left-0 right-0 flex justify-center pt-6 pb-0">
                    <div className="absolute inset-0 bg-linear-to-t from-secondary via-secondary/90 to-transparent" />
                    <button
                      type="button"
                      onClick={() => setIsUserMessageExpanded(true)}
                      className="relative z-10 p-1 rounded-full bg-secondary/80 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={2} />
                    </button>
                  </div>
                )}
                {needsCollapse && isUserMessageExpanded && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setIsUserMessageExpanded(false)}
                      className="p-1 rounded-full bg-secondary/80 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground transition-colors rotate-180"
                    >
                      <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={2} />
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3">
              {hasReasoning && !showRegenerationLoading && (
                <button
                  type="button"
                  onClick={() => onOpenReasoning(message.id)}
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
              {showRegenerationLoading ? (
                <div className="text-sm py-2">
                  <span className="text-foreground animate-pulse">●●●</span>
                </div>
              ) : (
                <CollapsibleCodeBlocks
                  className={cn(
                    'prose prose-sm prose-invert max-w-none',
                    (isLastAssistant || isBeingRegenerated) &&
                      isStreaming &&
                      '**:animate-in **:fade-in **:duration-150',
                  )}
                >
                  <Streamdown>{text}</Streamdown>
                </CollapsibleCodeBlocks>
              )}
              {!hideActions && (
                <div className="flex items-center gap-0.5">
                  <MessageUsageIndicator
                    usage={meta?.usage}
                    modelId={meta?.modelId || modelId}
                  />
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
                      const blob = new Blob([text], {
                        type: 'text/markdown',
                      })
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
                    icon={
                      sharedMessageMap?.has(message.id)
                        ? Globe02Icon
                        : Share01Icon
                    }
                    iconClassName={
                      sharedMessageMap?.has(message.id)
                        ? 'text-emerald-500 hover:text-emerald-400'
                        : undefined
                    }
                    onClick={() =>
                      onOpenShareDialog(message.id, userInput, text)
                    }
                    tooltip={
                      sharedMessageMap?.has(message.id)
                        ? 'Manage share'
                        : 'Share'
                    }
                  />
                </div>
              )}
            </div>
          )}
        </div>
        {/* User message actions */}
        {isUser && !isEditing && (
          <div className="flex items-center gap-0.5">
            <MessageAction
              icon={Copy01Icon}
              successIcon={Tick01Icon}
              successTooltip="Copied!"
              onClick={() => navigator.clipboard.writeText(text)}
              tooltip="Copy"
            />
            <MessageAction
              icon={PencilEdit01Icon}
              onClick={() => {
                // Capture the current width before entering edit mode
                if (messageContainerRef.current) {
                  setEditWidth(messageContainerRef.current.offsetWidth)
                }
                setEditText(text)
                setIsEditing(true)
              }}
              tooltip="Edit"
            />
          </div>
        )}
      </div>
    </div>
  )
}
