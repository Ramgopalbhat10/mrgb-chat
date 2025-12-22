import { useState, useEffect } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  MoreHorizontalIcon,
  PencilEdit01Icon,
  StarIcon,
  FolderAddIcon,
  Delete01Icon,
  StarOffIcon,
  Add01Icon,
  Folder01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'
import { useAppStore } from '@/stores/app-store'
import type { Conversation } from '@/lib/indexeddb'

interface Project {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

interface ConversationActionsDropdownProps {
  conversation: Conversation
  trigger?: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  onDeleted?: () => void
  onProjectsChanged?: () => void
}

export function ConversationActionsDropdown({
  conversation,
  trigger,
  side = 'bottom',
  align = 'end',
  onDeleted,
  onProjectsChanged,
}: ConversationActionsDropdownProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false)
  const [newTitle, setNewTitle] = useState(conversation.title)
  const [isLoading, setIsLoading] = useState(false)

  // Project state
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  const updateConversation = useAppStore((state) => state.updateConversation)
  const deleteConversation = useAppStore((state) => state.deleteConversation)

  // Fetch projects when dialog opens
  useEffect(() => {
    if (isAddToProjectOpen) {
      fetchProjects()
    }
  }, [isAddToProjectOpen])

  const fetchProjects = async () => {
    setIsLoadingProjects(true)
    try {
      // Fetch all projects and current conversation's project associations
      const [projectsRes, convProjectsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch(`/api/conversations/${conversation.id}/projects`),
      ])

      if (projectsRes.ok) {
        const data = await projectsRes.json()
        setProjects(data)
      }

      if (convProjectsRes.ok) {
        const projectIds = await convProjectsRes.json()
        setSelectedProjectIds(new Set(projectIds))
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return

    setIsCreatingProject(true)
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
        setShowCreateProject(false)
      }
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleToggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const handleSaveProjects = async () => {
    setIsSaving(true)
    try {
      // Get current projects for comparison
      const currentRes = await fetch(`/api/conversations/${conversation.id}/projects`)
      const currentProjectIds: string[] = currentRes.ok ? await currentRes.json() : []
      const currentSet = new Set(currentProjectIds)

      // Determine adds and removes
      const toAdd = [...selectedProjectIds].filter((id) => !currentSet.has(id))
      const toRemove = currentProjectIds.filter((id) => !selectedProjectIds.has(id))

      // Execute all changes
      await Promise.all([
        ...toAdd.map((projectId) =>
          fetch(`/api/projects/${projectId}/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: conversation.id }),
          })
        ),
        ...toRemove.map((projectId) =>
          fetch(`/api/projects/${projectId}/conversations?conversationId=${conversation.id}`, {
            method: 'DELETE',
          })
        ),
      ])

      setIsAddToProjectOpen(false)
      onProjectsChanged?.()
    } catch (error) {
      console.error('Failed to update projects:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRename = async () => {
    if (!newTitle.trim() || newTitle === conversation.title) {
      setIsRenameOpen(false)
      return
    }

    setIsLoading(true)
    try {
      await updateConversation(conversation.id, { title: newTitle.trim() })
      setIsRenameOpen(false)
    } catch (error) {
      console.error('Failed to rename conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleStar = async () => {
    try {
      await updateConversation(conversation.id, { starred: !conversation.starred })
    } catch (error) {
      console.error('Failed to toggle star:', error)
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deleteConversation(conversation.id)
      setIsDeleteOpen(false)
      onDeleted?.()
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none focus:ring-0">
          {trigger ?? <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />}
        </DropdownMenuTrigger>
        <DropdownMenuContent side={side} align={align} className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setIsRenameOpen(true)}>
              <HugeiconsIcon icon={PencilEdit01Icon} size={16} className="text-muted-foreground" />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleStar}>
              <HugeiconsIcon
                icon={conversation.starred ? StarOffIcon : StarIcon}
                size={16}
                className="text-muted-foreground"
              />
              <span>{conversation.starred ? 'Remove star' : 'Star'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsAddToProjectOpen(true)}>
              <HugeiconsIcon icon={FolderAddIcon} size={16} className="text-muted-foreground" />
              <span>Add to project</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => setIsDeleteOpen(true)}
              className="bg-red-900/80 text-white hover:bg-red-900 focus:bg-red-900 focus:text-white [&_svg]:text-white"
            >
              <HugeiconsIcon icon={Delete01Icon} size={16} />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>
              Enter a new name for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Conversation name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isLoading || !newTitle.trim()}>
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{conversation.title}" and all its messages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add to Project Dialog */}
      <Dialog open={isAddToProjectOpen} onOpenChange={setIsAddToProjectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to project</DialogTitle>
            <DialogDescription>
              Select a project to add this conversation to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : projects.length === 0 && !showCreateProject ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  No projects yet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateProject(true)}
                >
                  <HugeiconsIcon icon={Add01Icon} size={14} className="mr-1.5" />
                  Create project
                </Button>
              </div>
            ) : (
              <>
                {/* Create new project input */}
                {showCreateProject ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Project name"
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateProject()
                        } else if (e.key === 'Escape') {
                          setShowCreateProject(false)
                          setNewProjectName('')
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="default"
                      onClick={handleCreateProject}
                      disabled={isCreatingProject || !newProjectName.trim()}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <HugeiconsIcon icon={Add01Icon} size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setShowCreateProject(false)
                        setNewProjectName('')
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={16} />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateProject(true)}
                  >
                    <HugeiconsIcon icon={Add01Icon} size={14} className="mr-1.5" />
                    Create new project
                  </Button>
                )}

                {/* Project list with checkboxes */}
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {projects.map((project) => {
                    const isSelected = selectedProjectIds.has(project.id)
                    return (
                      <button
                        key={project.id}
                        onClick={() => handleToggleProject(project.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/50'
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3 text-primary-foreground"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <HugeiconsIcon
                          icon={Folder01Icon}
                          size={16}
                          className="text-muted-foreground shrink-0"
                        />
                        <span className="truncate flex-1">{project.name}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddToProjectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProjects} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
