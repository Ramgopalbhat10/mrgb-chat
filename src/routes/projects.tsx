import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChatHeader } from '@/features/chat/components'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Folder01Icon,
  Add01Icon,
  Delete01Icon,
  MoreHorizontalIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { projectKeys, projectsMetadataQueryOptions, type Project } from '@/features/chat/data/queries'

export const Route = createFileRoute('/projects')({
  component: ProjectsPage,
})

function ProjectsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [deleteProject, setDeleteProject] = useState<Project | null>(null)

  // Fetch projects using TanStack Query (cached)
  const { data: metadata, isLoading } = useQuery(projectsMetadataQueryOptions())
  const projects = metadata?.projects ?? []

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed to create project')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      setNewProjectName('')
      setIsCreateOpen(false)
    },
  })

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete project')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      setDeleteProject(null)
    },
  })

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return
    createMutation.mutate(newProjectName.trim())
  }

  const handleDeleteProject = () => {
    if (!deleteProject) return
    deleteMutation.mutate(deleteProject.id)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader title="Projects" />
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <HugeiconsIcon
                icon={Folder01Icon}
                size={24}
                strokeWidth={2}
                className="text-muted-foreground"
              />
            </div>
            <h2 className="text-lg font-medium text-foreground mb-2">
              No projects yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Create a project to organize your conversations by topic or
              context.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} className="mr-1.5" />
              Create project
            </Button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium">Your Projects</h2>
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} className="mr-1.5" />
                New project
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group p-4 rounded-lg border border-border/60 bg-card/50 hover:bg-accent/30 cursor-pointer transition-colors relative"
                  onClick={() => navigate({ to: '/project/$id', params: { id: project.id } })}
                >
                  <div className="flex items-start gap-3">
                    <HugeiconsIcon
                      icon={Folder01Icon}
                      size={18}
                      strokeWidth={2}
                      className="text-muted-foreground/70 shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm text-foreground truncate pr-8">
                        {project.name}
                      </h3>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground/70">
                        <span>
                          {project.conversationCount ?? 0} conversation
                          {(project.conversationCount ?? 0) !== 1 ? 's' : ''}
                        </span>
                        <span>
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Actions dropdown - always visible on mobile */}
                  <div
                    className="absolute top-3 right-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
                        <HugeiconsIcon icon={MoreHorizontalIcon} size={16} strokeWidth={2} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setDeleteProject(project)}
                          className="bg-destructive/90 text-destructive-foreground hover:bg-destructive! focus:bg-destructive!"
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={14} strokeWidth={2} />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Project Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              Create a new project to organize your conversations.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateProject()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={createMutation.isPending || !newProjectName.trim()}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteProject}
        onOpenChange={(open) => !open && setDeleteProject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteProject?.name}". Conversations
              in this project will not be deleted, only removed from the project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
