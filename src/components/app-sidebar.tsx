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
} from "./ui/sidebar";
import { Button } from "./ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { 
  Add01Icon, 
  Settings01Icon,
  UserIcon,
  Search01Icon,
  Folder01Icon,
  MessageMultiple01Icon,
} from "@hugeicons/core-free-icons";
import { Input } from "./ui/input";
import { Link, useLocation } from "@tanstack/react-router";
import type { Conversation } from "@/lib/indexeddb";
import { useAppStore } from "@/stores/app-store";

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
  const location = useLocation()
  const titleLoadingIds = useAppStore((state) => state.titleLoadingIds)
  const isHydrated = useAppStore((state) => state.isHydrated)
  const isChatsRoute = location.pathname === '/chats'
  const isProjectsRoute = location.pathname === '/projects'
  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="h-14 px-4 flex flex-row items-center justify-between border-b border-sidebar-border/50">
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
            <HugeiconsIcon icon={Add01Icon} size={18} />
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
                      className={isChatsRoute ? "text-foreground" : "text-muted-foreground"} 
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
                      className={isProjectsRoute ? "text-foreground" : "text-muted-foreground"} 
                    />
                    <span>Projects</span>
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
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" 
            />
            <Input 
              placeholder="Search..." 
              className="h-8 pl-9 text-sm bg-transparent border-sidebar-border/50 focus:border-primary/50"
            />
          </div>
          <SidebarGroupContent className="flex-1 overflow-y-auto">
            <SidebarMenu>
              {!isHydrated ? (
                // Loading skeleton - matches conversation item dimensions
                <div className="flex flex-col gap-0.5 p-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-2 h-8 px-3" style={{ opacity: 1 - (i - 1) * 0.2 }}>
                      <div className="w-3.5 h-3.5 bg-muted/50 rounded animate-pulse shrink-0" />
                      <div className="flex-1 h-3 bg-muted/50 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="px-3 py-6 text-xs text-muted-foreground/60 text-center">
                  No conversations yet
                </div>
              ) : (
                conversations.map((conversation) => {
                  const titleLoading = titleLoadingIds.has(conversation.id)
                  return (
                    <SidebarMenuItem key={conversation.id} className="p-0.5">
                      <SidebarMenuButton
                        isActive={conversation.id === activeConversationId}
                        onClick={() => onSelectConversation(conversation.id)}
                        className="w-full h-8 px-3 text-sm font-normal text-sidebar-foreground hover:text-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-foreground focus-visible:ring-primary/50 focus-visible:ring-offset-0"
                      >
                        {titleLoading ? (
                          <span className="flex-1 h-3 bg-muted/50 rounded animate-pulse" />
                        ) : (
                          <span className="truncate">{conversation.title}</span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border-0"
          >
            <HugeiconsIcon icon={UserIcon} size={18} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent border-0"
          >
            <HugeiconsIcon icon={Settings01Icon} size={18} />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}