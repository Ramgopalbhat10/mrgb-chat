import { HeadContent, Scripts, Outlet, createRootRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useAppStore } from '@/stores/app-store'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'MRGB Chat',
      },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { 
        rel: 'stylesheet', 
        href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap'
      },
      {
        rel: 'stylesheet', 
        href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap'
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const navigate = useNavigate()
  const conversations = useAppStore((state) => state.conversations)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const hydrate = useAppStore((state) => state.hydrate)
  const handleNewChat = useAppStore((state) => state.handleNewChat)
  const setActiveConversationId = useAppStore((state) => state.setActiveConversationId)

  // Hydrate from IndexedDB on mount
  useEffect(() => {
    hydrate()
  }, [hydrate])

  const onNewChat = () => {
    handleNewChat()
    navigate({ to: '/new' })
  }

  const onSelectConversation = (id: string) => {
    setActiveConversationId(id) // Set immediately for sidebar highlighting
    navigate({ to: '/chat/$id', params: { id } })
  }

  return (
    <SidebarProvider style={
      {
        "--sidebar-width": "18rem",
        "--sidebar-width-mobile": "18rem",
      } as React.CSSProperties
    }>
      <AppSidebar 
        conversations={conversations}
        activeConversationId={activeConversationId ?? ''}
        onNewChat={onNewChat}
        onSelectConversation={onSelectConversation}
      />
      <SidebarInset className="bg-background">
        <main className="flex flex-col h-screen">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className='dark'>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
