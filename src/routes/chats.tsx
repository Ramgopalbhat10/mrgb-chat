import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChatHeader } from '@/features/chat/components'
import { HugeiconsIcon } from '@hugeicons/react'
import { Message01Icon, Calendar03Icon } from '@hugeicons/core-free-icons'
import { useAppStore } from '@/stores/app-store'

export const Route = createFileRoute('/chats')({
  component: ChatsPage,
})

function ChatsPage() {
  const navigate = useNavigate()
  const conversations = useAppStore((state) => state.conversations)

  const handleSelectConversation = (id: string) => {
    navigate({ to: '/chat/$id', params: { id } })
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader title="All Chats" />
      <div className="flex-1 overflow-y-auto p-6">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <HugeiconsIcon
                icon={Message01Icon}
                size={24}
                className="text-muted-foreground"
              />
            </div>
            <h2 className="text-lg font-medium text-foreground mb-2">
              No conversations yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Start a new chat to begin a conversation. Your chat history will
              appear here.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation.id)}
                className="w-full text-left p-4 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <HugeiconsIcon
                      icon={Message01Icon}
                      size={16}
                      className="text-muted-foreground shrink-0"
                    />
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {conversation.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <HugeiconsIcon icon={Calendar03Icon} size={12} />
                    <span>{conversation.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
