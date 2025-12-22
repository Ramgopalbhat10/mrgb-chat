import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { HugeiconsIcon } from '@hugeicons/react'
import { Share01Icon, SidebarLeftIcon } from '@hugeicons/core-free-icons'
import { ConversationActionsDropdown } from './conversation-actions-dropdown'
import type { Conversation } from '@/lib/indexeddb'

interface ChatHeaderProps {
  title?: string
  isLoading?: boolean
  conversation?: Conversation
  onDeleted?: () => void
}

export function ChatHeader({
  title,
  isLoading,
  conversation,
  onDeleted,
}: ChatHeaderProps) {
  const { state, toggleSidebar, isMobile } = useSidebar()
  // Show toggle on mobile (always, since sidebar is a sheet) or desktop when collapsed
  const showToggle = isMobile || state === 'collapsed'

  return (
    <header className="flex items-center justify-between h-10 px-4 border-b border-sidebar-border/50 shrink-0 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex items-center gap-3 min-w-0">
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
            <HugeiconsIcon icon={SidebarLeftIcon} size={16} />
          </Button>
        </div>
        {isLoading ? (
          <div className="h-4 w-48 bg-muted/50 rounded animate-pulse" />
        ) : (
          <h1 className="text-sm font-medium text-foreground truncate">
            {title}
          </h1>
        )}
      </div>
      <div className="flex items-center gap-1">
        {/* Share button - with label on desktop, icon only on mobile */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground hover:text-foreground border-0 gap-1.5"
        >
          <HugeiconsIcon icon={Share01Icon} size={16} />
          <span className="hidden sm:inline text-sm">Share</span>
        </Button>
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
    </header>
  )
}
