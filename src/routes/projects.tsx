import { createFileRoute } from '@tanstack/react-router'
import { ChatHeader } from '@/features/chat/components'
import { HugeiconsIcon } from '@hugeicons/react'
import { Folder01Icon, Calendar03Icon } from '@hugeicons/core-free-icons'

export const Route = createFileRoute('/projects')({
  component: ProjectsPage,
})

function ProjectsPage() {
  // TODO: Replace with real data from TanStack Query
  const projects: Array<{
    id: string
    name: string
    description: string
    createdAt: Date
    conversationCount: number
  }> = []

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader title="Projects" />
      <div className="flex-1 overflow-y-auto p-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <HugeiconsIcon
                icon={Folder01Icon}
                size={24}
                className="text-muted-foreground"
              />
            </div>
            <h2 className="text-lg font-medium text-foreground mb-2">
              No projects yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Create a project to organize your conversations by topic or
              context.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <HugeiconsIcon
                      icon={Folder01Icon}
                      size={20}
                      className="text-primary"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {project.name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {project.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                  <span>{project.conversationCount} conversations</span>
                  <div className="flex items-center gap-1">
                    <HugeiconsIcon icon={Calendar03Icon} size={12} />
                    <span>{project.createdAt.toLocaleDateString()}</span>
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
