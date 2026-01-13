import {
  Copy01Icon,
  Globe02Icon,
  Loading03Icon,
  LockIcon,
  Tick01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type ShareDialogMessage = {
  id: string
  userInput: string
  response: string
} | null

interface ShareResponseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: ShareDialogMessage
  shareMode: 'private' | 'public'
  isUpdating: boolean
  copied: boolean
  sharedMessageMap?: Map<string, string>
  onShareModeChange: (mode: 'private' | 'public') => void
  onCopyLink: () => void
}

export function ShareResponseDialog({
  open,
  onOpenChange,
  message,
  shareMode,
  isUpdating,
  copied,
  sharedMessageMap,
  onShareModeChange,
  onCopyLink,
}: ShareResponseDialogProps) {
  const canCopy =
    shareMode === 'public' && !!message && sharedMessageMap?.has(message.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share response</DialogTitle>
          <DialogDescription>
            Share this response publicly with a link.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <button
            onClick={() => onShareModeChange('private')}
            disabled={isUpdating}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              shareMode === 'private'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-accent/50'
            } disabled:opacity-50`}
          >
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
              <HugeiconsIcon
                icon={LockIcon}
                size={18}
                strokeWidth={2}
                className="text-muted-foreground"
              />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Private</div>
              <div className="text-xs text-muted-foreground">
                Only you have access
              </div>
            </div>
            {shareMode === 'private' && (
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-primary-foreground"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          <button
            onClick={() => onShareModeChange('public')}
            disabled={isUpdating}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              shareMode === 'public'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-accent/50'
            } disabled:opacity-50`}
          >
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
              <HugeiconsIcon
                icon={Globe02Icon}
                size={18}
                strokeWidth={2}
                className="text-muted-foreground"
              />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Public access</div>
              <div className="text-xs text-muted-foreground">
                Anyone with the link can view
              </div>
            </div>
            {shareMode === 'public' && (
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                {isUpdating ? (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    size={12}
                    strokeWidth={2}
                    className="text-primary-foreground animate-spin"
                  />
                ) : (
                  <svg
                    className="w-3 h-3 text-primary-foreground"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            )}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Don't share personal information or third-party content without
          permission.
        </p>

        <DialogFooter>
          <Button
            onClick={onCopyLink}
            disabled={!canCopy || isUpdating}
            className="w-full sm:w-auto"
          >
            {copied ? (
              <>
                <HugeiconsIcon
                  icon={Tick01Icon}
                  size={16}
                  strokeWidth={2}
                  className="mr-1.5"
                />
                Copied!
              </>
            ) : (
              <>
                <HugeiconsIcon
                  icon={Copy01Icon}
                  size={16}
                  strokeWidth={2}
                  className="mr-1.5"
                />
                Copy share link
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
