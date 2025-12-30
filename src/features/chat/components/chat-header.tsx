import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { sharedKeys } from '@/features/chat/data/queries'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { HugeiconsIcon } from '@hugeicons/react'
import { Share01Icon, SidebarLeftIcon, LockIcon, Globe02Icon, Copy01Icon, Tick02Icon, Loading03Icon } from '@hugeicons/core-free-icons'
import { ConversationActionsDropdown } from './conversation-actions-dropdown'
import type { Conversation } from '@/lib/indexeddb'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ChatHeaderProps {
  title?: string
  isLoading?: boolean
  conversation?: Conversation
  onDeleted?: () => void
  showShare?: boolean
}

export function ChatHeader({
  title,
  isLoading,
  conversation,
  onDeleted,
  showShare = false,
}: ChatHeaderProps) {
  const { state, toggleSidebar, isMobile } = useSidebar()
  const queryClient = useQueryClient()
  // Show toggle on mobile (always, since sidebar is a sheet) or desktop when collapsed
  const showToggle = isMobile || state === 'collapsed'
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [shareMode, setShareMode] = useState<'private' | 'public'>('private')
  const [copied, setCopied] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const shareUrl = conversation ? `${window.location.origin}/share/${conversation.id}` : ''

  // Initialize share mode based on conversation's current isPublic state
  useEffect(() => {
    if (conversation && isShareOpen) {
      setShareMode(conversation.isPublic ? 'public' : 'private')
    }
  }, [conversation, isShareOpen])

  const updateShareStatus = async (isPublic: boolean) => {
    if (!conversation) return
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic }),
      })
      if (response.ok) {
        // Update local conversation state if needed
        conversation.isPublic = isPublic
        // Invalidate shared items query to update the list
        queryClient.invalidateQueries({ queryKey: sharedKeys.all })
      }
    } catch (error) {
      console.error('Failed to update share status:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleShareModeChange = async (mode: 'private' | 'public') => {
    // Avoid redundant API calls if already in this mode
    if (shareMode === mode) return
    setShareMode(mode)
    await updateShareStatus(mode === 'public')
  }

  const handleCopyLink = async () => {
    // Ensure conversation is public before copying
    if (shareMode === 'public' && !conversation?.isPublic) {
      await updateShareStatus(true)
    }
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <header className="flex items-center justify-between h-10 px-4 border-b border-sidebar-border/50 shrink-0 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        {/* Sidebar toggle - visible on mobile or when sidebar is collapsed */}
        <div
          className={`transition-all duration-200 ease-out ${showToggle ? 'w-8 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 text-muted-foreground hover:text-foreground border-0 shrink-0"
          >
            <HugeiconsIcon icon={SidebarLeftIcon} size={16} strokeWidth={2} />
          </Button>
        </div>
        {isLoading ? (
          <div className="h-4 w-48 bg-muted/50 rounded animate-pulse" />
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-sm font-medium text-foreground truncate">
              {title}
            </h1>
            {conversation?.isPublic && (
              <span title="This conversation is shared publicly">
                <HugeiconsIcon 
                  icon={Globe02Icon} 
                  size={14} 
                  strokeWidth={2} 
                  className="text-emerald-500 shrink-0" 
                />
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {/* Share button - only shown on /chat/$id routes */}
        {showShare && conversation && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsShareOpen(true)}
            className="h-8 text-muted-foreground hover:text-foreground border-0 gap-1.5"
          >
            <HugeiconsIcon icon={Share01Icon} size={16} strokeWidth={2} />
            <span className="hidden sm:inline text-sm">Share</span>
          </Button>
        )}
        {/* Actions dropdown */}
        {conversation && (
          <ConversationActionsDropdown
            conversation={conversation}
            side="bottom"
            align="end"
            onDeleted={onDeleted}
          />
        )}
      </div>

      {/* Share Dialog */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share chat</DialogTitle>
            <DialogDescription>
              Only messages up until now will be shared.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {/* Private option */}
            <button
              onClick={() => handleShareModeChange('private')}
              disabled={isUpdating}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                shareMode === 'private'
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
              disabled={isUpdating}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                shareMode === 'public'
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
                  {isUpdating ? (
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
              onClick={handleCopyLink}
              disabled={shareMode === 'private' || isUpdating}
              className="w-full sm:w-auto"
            >
              {copied ? (
                <>
                  <HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2} className="mr-1.5" />
                  Copied!
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Copy01Icon} size={16} strokeWidth={2} className="mr-1.5" />
                  Create share link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
