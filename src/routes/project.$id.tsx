import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChatHeader } from '@/features/chat/components'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Folder01Icon,
  Message01Icon,
  ArrowLeft01Icon,
  Calendar03Icon,
  StarIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { ConversationActionsDropdown } from '@/features/chat/components/conversation-actions-dropdown'

interface Project {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export const Route = createFileRoute('/project/$id')({
  component: ProjectDetailPage,
})

function ProjectDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const conversations = useAppStore((state) => state.conversations)

  const [project, setProject] = useState<Project | null>(null)
  const [conversationIds, setConversationIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchProjectData()
  }, [id])

  const fetchProjectData = async () => {
    setIsLoading(true)
    try {
      // Fetch project details and conversations in parallel
      const [projectResponse, convsResponse] = await Promise.all([
        fetch(`/api/projects`),
        fetch(`/api/projects/${id}/conversations`),
      ])

      if (projectResponse.ok) {
        const projectsList = await projectResponse.json()
        const foundProject = projectsList.find((p: Project) => p.id === id)
        setProject(foundProject || null)
      }

      if (convsResponse.ok) {
        const convIds = await convsResponse.json()
        console.log('Project conversations:', convIds)
        setConversationIds(convIds)
      } else {
        console.error('Failed to fetch conversations:', convsResponse.status)
      }
    } catch (error) {
      console.error('Failed to fetch project data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectConversation = (convId: string) => {
    navigate({ to: '/chat/$id', params: { id: convId } })
  }

  // Filter conversations that are in this project
  const projectConversations = conversations.filter((c) =>
    conversationIds.includes(c.id),
  )

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <ChatHeader title="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col h-full bg-background">
        <ChatHeader title="Project not found" />
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-muted-foreground mb-4">
            This project doesn't exist.
          </p>
          <Button variant="outline" onClick={() => navigate({ to: '/projects' })}>
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader title={project.name} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* Back button and header */}
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate({ to: '/projects' })}
              className="h-8 w-8"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <HugeiconsIcon
                  icon={Folder01Icon}
                  size={20}
                  strokeWidth={2}
                  className="text-muted-foreground"
                />
              </div>
              <div>
                <h1 className="text-lg font-medium">{project.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {projectConversations.length} conversation
                  {projectConversations.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Conversations list */}
          {projectConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
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
                Add conversations to this project using the "Add to project"
                option in any conversation's menu.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {projectConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="group relative w-full text-left p-4 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => handleSelectConversation(conversation.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <HugeiconsIcon
                        icon={Message01Icon}
                        size={16}
                        strokeWidth={2}
                        className="text-muted-foreground shrink-0"
                      />
                      {conversation.starred && (
                        <HugeiconsIcon
                          icon={StarIcon}
                          size={12}
                          strokeWidth={2}
                          className="text-yellow-500 shrink-0"
                        />
                      )}
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {conversation.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <HugeiconsIcon icon={Calendar03Icon} size={12} strokeWidth={2} />
                        <span>
                          {new Date(conversation.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {/* Three dots menu */}
                      <div
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ConversationActionsDropdown
                          conversation={conversation}
                          side="bottom"
                          align="end"
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
    </div>
  )
}
