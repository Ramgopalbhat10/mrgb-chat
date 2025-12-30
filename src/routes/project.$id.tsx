import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChatHeader, ConversationList } from '@/features/chat/components'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app-store'
import { projectsQueryOptions, projectConversationsQueryOptions } from '@/features/chat/data/queries'

export const Route = createFileRoute('/project/$id')({
  component: ProjectDetailPage,
})

function ProjectDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const conversations = useAppStore((state) => state.conversations)

  // Fetch projects list using TanStack Query (cached)
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery(projectsQueryOptions())
  const project = projects.find((p) => p.id === id)

  // Fetch project conversations using TanStack Query (cached)
  const { data: conversationIds = [], isLoading: isLoadingConvs } = useQuery(
    projectConversationsQueryOptions(id)
  )

  const isLoading = isLoadingProjects || isLoadingConvs

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
