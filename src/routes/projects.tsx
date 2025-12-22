import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChatHeader } from '@/features/chat/components'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Folder01Icon,
  Calendar03Icon,
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

interface Project {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  conversationCount?: number
}

export const Route = createFileRoute('/projects')({
  component: ProjectsPage,
})

function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [deleteProject, setDeleteProject] = useState<Project | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    setIsLoading(true)
    try {
      // Use cached metadata endpoint
      const response = await fetch('/api/projects/metadata')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects)
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return

    setIsCreating(true)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() }),
      })

      if (response.ok) {
        const newProject = await response.json()
        setProjects((prev) => [newProject, ...prev])
        setNewProjectName('')
        setIsCreateOpen(false)
      }
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!deleteProject) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/projects?id=${deleteProject.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteProject.id))
        setDeleteProject(null)
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
    } finally {
      setIsDeleting(false)
    }
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
              <HugeiconsIcon icon={Add01Icon} size={16} className="mr-1.5" />
              Create project
            </Button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium">Your Projects</h2>
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <HugeiconsIcon icon={Add01Icon} size={14} className="mr-1.5" />
                New project
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group p-4 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors relative"
                  onClick={() => navigate({ to: '/project/$id', params: { id: project.id } })}
                >
                  <div className="flex items-start gap-3">
                    <HugeiconsIcon
                      icon={Folder01Icon}
                      size={20}
                      className="text-muted-foreground shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground truncate pr-8">
                        {project.name}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                    <span>
                      {project.conversationCount ?? 0} conversation
                      {(project.conversationCount ?? 0) !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      <HugeiconsIcon icon={Calendar03Icon} size={12} />
                      <span>
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {/* Actions dropdown */}
                  <div
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
                        <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setDeleteProject(project)}
                          className="bg-red-900/80 text-white hover:bg-red-900 focus:bg-red-900 focus:text-white [&_svg]:text-white"
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={16} />
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
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={isCreating || !newProjectName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create'}
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
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
