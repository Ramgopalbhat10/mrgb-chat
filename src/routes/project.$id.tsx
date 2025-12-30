import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChatHeader, ConversationList } from '@/features/chat/components'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'

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
        // console.log('Project conversations:', convIds)
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
          {/* Back button */}
          <div className="mb-6">
            <button
              onClick={() => navigate({ to: '/projects' })}
              className="px-2 py-1 rounded-md flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2} />
              Back to Projects
            </button>
          </div>

          {/* Conversations list using shared component */}
          <ConversationList
            conversations={projectConversations}
            title={` Your Conversation${projectConversations.length !== 1 ? 's' : ''}`}
            emptyMessage="No conversations yet"
            emptyDescription="Add conversations to this project using the Add to project option in any conversation's menu."
          />
        </div>
      </div>
    </div>
  )
}
