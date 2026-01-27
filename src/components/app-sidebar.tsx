import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from './ui/sidebar'
import { Button } from './ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Settings01Icon,
  Search01Icon,
  Folder01Icon,
  MessageMultiple01Icon,
  Logout01Icon,
  StarIcon,
  Share01Icon,
  GitBranchIcon,
} from '@hugeicons/core-free-icons'
import { Input } from './ui/input'
import { Link, useLocation } from '@tanstack/react-router'
import type { Conversation } from '@/lib/indexeddb'
import { useAppStore } from '@/stores/app-store'
import { useAuth } from '@/providers/auth-provider'
import { ConversationActionsDropdown } from '@/features/chat/components'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { useSidebar } from './ui/sidebar'

interface AppSidebarProps {
  conversations: Conversation[]
  activeConversationId: string
  onNewChat: () => void
  onSelectConversation: (id: string) => void
}

export function AppSidebar({
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
}: AppSidebarProps) {
  const conversationIdSet = useMemo(
    () => new Set(conversations.map((conversation) => conversation.id)),
    [conversations],
  )
  const location = useLocation()
  const navigate = useNavigate()
  const titleLoadingIds = useAppStore((state) => state.titleLoadingIds)
  const isHydrated = useAppStore((state) => state.isHydrated)
  const { user, signOut } = useAuth()
  const { isMobile } = useSidebar()

  const handleConversationDeleted = (conversationId: string) => {
    // If the deleted conversation was active, navigate to new chat
    if (conversationId === activeConversationId) {
      navigate({ to: '/new' })
    }
  }
  const isChatsRoute = location.pathname === '/chats'
  const isProjectsRoute =
    location.pathname === '/projects' ||
    location.pathname.startsWith('/project/')
  const isSharedRoute = location.pathname === '/shared'

  // Don't highlight conversations when on /chats, /projects, /shared routes
  const isOnConversationRoute =
    location.pathname.startsWith('/chat/') || location.pathname === '/new'
  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="h-10 px-4 flex flex-row items-center justify-between border-b border-sidebar-border/50">
        <span className="text-sm font-semibold tracking-wider text-foreground">
          CHAT
        </span>
        <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent" />
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup className="py-4">
          <Button
            onClick={onNewChat}
            className="w-full justify-center gap-2 h-8 text-sm bg-primary hover:bg-primary/90 font-medium text-primary-foreground shadow-none"
          >
            <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2} />
            New chat
          </Button>
          <div className="h-4" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isChatsRoute}
                className="w-full h-8 px-3 mb-0.5 text-sm font-medium"
                render={(props) => (
                  <Link to="/chats" {...props}>
                    <HugeiconsIcon
                      icon={MessageMultiple01Icon}
                      size={16}
                      strokeWidth={2}
                      className={
                        isChatsRoute
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }
                    />
                    <span>Chats</span>
                  </Link>
                )}
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isProjectsRoute}
                className="w-full h-8 px-3 mb-0.5 text-sm font-medium"
                render={(props) => (
                  <Link to="/projects" {...props}>
                    <HugeiconsIcon
                      icon={Folder01Icon}
                      size={16}
                      strokeWidth={2}
                      className={
                        isProjectsRoute
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }
                    />
                    <span>Projects</span>
                  </Link>
                )}
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isSharedRoute}
                className="w-full h-8 px-3 mb-0.5 text-sm font-medium"
                render={(props) => (
                  <Link to="/shared" {...props}>
                    <HugeiconsIcon
                      icon={Share01Icon}
                      size={16}
                      strokeWidth={2}
                      className={
                        isSharedRoute
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }
                    />
                    <span>Shared</span>
                  </Link>
                )}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="py-1 flex-1 overflow-hidden flex flex-col">
          <SidebarGroupLabel className="text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase px-3 mb-1">
            Recent
          </SidebarGroupLabel>
          <div className="relative mb-2">
            <HugeiconsIcon
              icon={Search01Icon}
              size={14}
              strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50"
            />
            <Input
              placeholder="Search..."
              className="h-8 pl-9 text-sm bg-transparent border-sidebar-border/50 focus:border-primary/50"
            />
          </div>
          <SidebarGroupContent className="flex-1 overflow-y-auto overflow-x-hidden">
            <SidebarMenu>
              {!isHydrated ? (
                // Loading skeleton - matches conversation item dimensions
                <div className="flex flex-col gap-0.5 p-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 h-8 px-3"
                      style={{ opacity: 1 - (i - 1) * 0.2 }}
                    >
                      <div className="w-3.5 h-3.5 bg-muted/50 rounded animate-pulse shrink-0" />
                      <div className="flex-1 h-3 bg-muted/50 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : conversations.filter((c) => !c.archived).length === 0 ? (
                <div className="px-3 py-6 text-xs text-muted-foreground/60 text-center">
                  No conversations yet
                </div>
              ) : (
                conversations
                  .filter((c) => !c.archived)
                  .map((conversation) => {
                    const titleLoading = titleLoadingIds.has(conversation.id)
                    const isUuidLike = (value?: string | null) =>
                      typeof value === 'string' &&
                      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                        value,
                      )
                    const hasValidForkId =
                      isUuidLike(conversation.forkedFromConversationId) &&
                      conversationIdSet.has(
                        conversation.forkedFromConversationId as string,
                      )
                    const hasValidForkMessageId =
                      typeof conversation.forkedFromMessageId === 'string' &&
                      conversation.forkedFromMessageId.trim().length > 0 &&
                      conversation.forkedFromMessageId !== 'null' &&
                      conversation.forkedFromMessageId !== 'undefined'
                    const isBranched =
                      hasValidForkId &&
                      hasValidForkMessageId &&
                      conversation.forkedFromConversationId !== conversation.id
                    const displayTitle =
                      isBranched && conversation.title.startsWith('Branch of ')
                        ? conversation.title.replace(/^Branch of\s+/, '')
                        : conversation.title
                    // Only highlight conversation if we're on a conversation route
                    const isActive =
                      isOnConversationRoute &&
                      conversation.id === activeConversationId
                    return (
                      <SidebarMenuItem
                        key={conversation.id}
                        className="group/item p-0.5 relative"
                      >
                        <Tooltip>
                          <TooltipTrigger
                            render={(triggerProps) => (
                              <SidebarMenuButton
                                {...triggerProps}
                                isActive={isActive}
                                onClick={() =>
                                  onSelectConversation(conversation.id)
                                }
                                className="w-full h-8 px-3 pr-8 text-sm font-normal text-sidebar-foreground hover:text-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-foreground focus-visible:ring-primary/50 focus-visible:ring-offset-0"
                              >
                                {conversation.starred && (
                                  <HugeiconsIcon
                                    icon={StarIcon}
                                    size={12}
                                    strokeWidth={2}
                                    className="text-yellow-500 shrink-0"
                                  />
                                )}
                                {isBranched && (
                                  <HugeiconsIcon
                                    icon={GitBranchIcon}
                                    size={12}
                                    strokeWidth={2}
                                    className="text-muted-foreground/70 shrink-0"
                                  />
                                )}
                                {titleLoading ? (
                                  <span className="flex-1 h-3 bg-muted/50 rounded animate-pulse" />
                                ) : (
                                  <span className="truncate">
                                    {displayTitle}
                                  </span>
                                )}
                              </SidebarMenuButton>
                            )}
                          />
                          <TooltipContent
                            side="right"
                            className="bg-secondary text-secondary-foreground max-w-xs"
                          >
                            {displayTitle}
                          </TooltipContent>
                        </Tooltip>
                        {/* Three dots menu - always visible on mobile, hover on desktop */}
                        <div
                          className={`absolute right-1 top-1/2 -translate-y-1/2 ${
                            isMobile
                              ? 'opacity-100'
                              : `opacity-0 group-hover/item:opacity-100 ${isActive ? 'opacity-100' : ''}`
                          } transition-opacity`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ConversationActionsDropdown
                            conversation={conversation}
                            side="right"
                            align="start"
                            onDeleted={() =>
                              handleConversationDeleted(conversation.id)
                            }
                          />
                        </div>
                      </SidebarMenuItem>
                    )
                  })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || 'User'}
                className="h-7 w-7 rounded-full shrink-0"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-muted shrink-0" />
            )}
            <span className="text-xs text-sidebar-foreground truncate">
              {user?.name || user?.email || 'User'}
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/70 hover:text-foreground hover:bg-sidebar-accent border-0"
            >
              <HugeiconsIcon icon={Settings01Icon} size={16} strokeWidth={2} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="h-7 w-7 text-muted-foreground/70 hover:text-foreground hover:bg-sidebar-accent border-0"
              title="Sign out"
            >
              <HugeiconsIcon icon={Logout01Icon} size={16} strokeWidth={2} />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
