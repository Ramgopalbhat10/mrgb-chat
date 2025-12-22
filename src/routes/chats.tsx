import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChatHeader } from '@/features/chat/components'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Message01Icon,
  StarIcon,
  Folder01Icon,
} from '@hugeicons/core-free-icons'
import { useAppStore } from '@/stores/app-store'
import { ConversationActionsDropdown } from '@/features/chat/components/conversation-actions-dropdown'

interface Project {
  id: string
  name: string
}

export const Route = createFileRoute('/chats')({
  component: ChatsPage,
})

function ChatsPage() {
  const navigate = useNavigate()
  const conversations = useAppStore((state) => state.conversations)
  const [projects, setProjects] = useState<Project[]>([])
  const [conversationProjects, setConversationProjects] = useState<
    Record<string, string[]>
  >({})

  useEffect(() => {
    fetchProjectsData()
  }, [])

  const fetchProjectsData = async () => {
    try {
      // Fetch all projects metadata in a single call (cached)
      const res = await fetch('/api/projects/metadata')
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects)
        setConversationProjects(data.conversationProjects)
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    }
  }

  const getProjectsForConversation = (conversationId: string): Project[] => {
    const projectIds = conversationProjects[conversationId] || []
    return projects.filter((p) => projectIds.includes(p.id))
  }

  const handleSelectConversation = (id: string) => {
    navigate({ to: '/chat/$id', params: { id } })
  }

  // Filter out archived conversations
  const visibleConversations = conversations.filter((c) => !c.archived)

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader title="All Chats" />
      <div className="flex-1 overflow-y-auto p-6">
        {visibleConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <HugeiconsIcon
                icon={Message01Icon}
                size={24}
                strokeWidth={2}
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
          <div className="max-w-3xl mx-auto space-y-1">
            {visibleConversations.map((conversation) => (
              <div
                key={conversation.id}
                className="group relative w-full text-left px-4 py-3 rounded-md hover:bg-accent/40 cursor-pointer transition-colors"
                onClick={() => handleSelectConversation(conversation.id)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0 flex items-start gap-3">
                    <HugeiconsIcon
                      icon={Message01Icon}
                      size={16}
                      strokeWidth={2}
                      className="text-muted-foreground/60 shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm text-foreground truncate">
                          {conversation.title}
                        </h3>
                        {conversation.starred && (
                          <HugeiconsIcon
                            icon={StarIcon}
                            size={12}
                            strokeWidth={2}
                            className="text-yellow-500 shrink-0"
                          />
                        )}
                      </div>
                      {/* Project badges */}
                      {getProjectsForConversation(conversation.id).length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {getProjectsForConversation(conversation.id).map((project) => (
                            <span
                              key={project.id}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-muted/60 text-muted-foreground"
                            >
                              <HugeiconsIcon icon={Folder01Icon} size={10} strokeWidth={2} />
                              {project.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground/70">
                      {new Date(conversation.createdAt).toLocaleDateString()}
                    </span>
                    {/* Three dots menu - visible on hover */}
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ConversationActionsDropdown
                        conversation={conversation}
                        side="bottom"
                        align="end"
                        onProjectsChanged={fetchProjectsData}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
