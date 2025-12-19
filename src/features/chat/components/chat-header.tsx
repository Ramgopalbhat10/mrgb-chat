import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  MoreHorizontalIcon,
  Share01Icon,
  Delete01Icon,
  SidebarLeftIcon,
} from '@hugeicons/core-free-icons'

interface ChatHeaderProps {
  title?: string
  isLoading?: boolean
}

export function ChatHeader({ title, isLoading }: ChatHeaderProps) {
  const { state, toggleSidebar } = useSidebar()
  const isSidebarClosed = state === 'collapsed'

  return (
    <header className="flex items-center justify-between h-10 px-4 border-b border-sidebar-border/50 shrink-0 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex items-center gap-3 min-w-0">
        {/* Sidebar toggle - only visible when sidebar is closed */}
        <div
          className={`transition-all duration-200 ease-out ${isSidebarClosed ? 'w-8 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}
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
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground border-0"
        >
          <HugeiconsIcon icon={Share01Icon} size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground border-0"
        >
          <HugeiconsIcon icon={Delete01Icon} size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground border-0"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
        </Button>
      </div>
    </header>
  )
}
