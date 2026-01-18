import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import type { Conversation } from '@/lib/indexeddb'
import { projectKeys, projectsQueryOptions, sharedKeys } from '../../data/queries'
import { useDeleteConversation, useUpdateConversation } from '@/features/chat/data/mutations'

interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  conversationCount?: number
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
  const queryClient = useQueryClient()
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false)
  const [newTitle, setNewTitle] = useState(conversation.title)
  const [isLoading, setIsLoading] = useState(false)

  // Project state
  const [newProjectName, setNewProjectName] = useState('')
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [initialProjectIds, setInitialProjectIds] = useState<Set<string>>(new Set())

  const updateConversation = useUpdateConversation()
  const deleteConversation = useDeleteConversation()

  // Fetch projects using TanStack Query (cached)
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    ...projectsQueryOptions(),
    enabled: isAddToProjectOpen,
  })

  // Fetch conversation's current project associations
  const { data: convProjectIds = [] } = useQuery({
    queryKey: ['conversations', conversation.id, 'projects'],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversation.id}/projects`)
      if (!res.ok) throw new Error('Failed to fetch conversation projects')
      return res.json() as Promise<string[]>
    },
    enabled: isAddToProjectOpen,
  })

  // Sync selected projects when data loads
  useEffect(() => {
    if (isAddToProjectOpen && convProjectIds.length >= 0) {
      const set = new Set(convProjectIds)
      setSelectedProjectIds(set)
      setInitialProjectIds(set)
    }
  }, [isAddToProjectOpen, convProjectIds])

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed to create project')
      return res.json() as Promise<Project>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      setNewProjectName('')
      setShowCreateProject(false)
    },
  })

  // Save project associations mutation
  const saveProjectsMutation = useMutation({
    mutationFn: async () => {
      const toAdd = [...selectedProjectIds].filter((id) => !initialProjectIds.has(id))
      const toRemove = [...initialProjectIds].filter((id) => !selectedProjectIds.has(id))

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
    },
    onSuccess: () => {
      // Invalidate all project-related queries
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      queryClient.invalidateQueries({ queryKey: ['conversations', conversation.id, 'projects'] })
      setIsAddToProjectOpen(false)
      onProjectsChanged?.()
    },
  })

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return
    createProjectMutation.mutate(newProjectName.trim())
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

  const handleSaveProjects = () => {
    saveProjectsMutation.mutate()
  }

  const handleRename = async () => {
    if (!newTitle.trim() || newTitle === conversation.title) {
      setIsRenameOpen(false)
      return
    }

    setIsLoading(true)
    try {
      await updateConversation.mutateAsync({
        id: conversation.id,
        updates: { title: newTitle.trim() },
      })
      setIsRenameOpen(false)
    } catch (error) {
      console.error('Failed to rename conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleStar = async () => {
    try {
      await updateConversation.mutateAsync({
        id: conversation.id,
        updates: { starred: !conversation.starred },
      })
    } catch (error) {
      console.error('Failed to toggle star:', error)
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deleteConversation.mutateAsync(conversation.id)
      
      // Force refetch of all project and shared queries (not just invalidate)
      await Promise.all([
        queryClient.refetchQueries({ queryKey: projectKeys.all }),
        queryClient.refetchQueries({ queryKey: sharedKeys.all }),
      ])
      
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
          {trigger ?? <HugeiconsIcon icon={MoreHorizontalIcon} size={16} strokeWidth={2} />}
        </DropdownMenuTrigger>
        <DropdownMenuContent side={side} align={align} className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setIsRenameOpen(true)}>
              <HugeiconsIcon icon={PencilEdit01Icon} size={14} strokeWidth={2} />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleStar}>
              <HugeiconsIcon
                icon={conversation.starred ? StarOffIcon : StarIcon}
                size={14}
                strokeWidth={2}
              />
              <span>{conversation.starred ? 'Unstar' : 'Star'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsAddToProjectOpen(true)}>
              <HugeiconsIcon icon={FolderAddIcon} size={14} strokeWidth={2} />
              <span>Add to project</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => setIsDeleteOpen(true)}
              className="bg-destructive/90 text-destructive-foreground hover:bg-destructive! focus:bg-destructive!"
            >
              <HugeiconsIcon icon={Delete01Icon} size={14} strokeWidth={2} />
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
                  <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} className="mr-1.5" />
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
                      disabled={createProjectMutation.isPending || !newProjectName.trim()}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} />
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
                      <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateProject(true)}
                  >
                    <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} className="mr-1.5" />
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
                          strokeWidth={2}
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
            <Button onClick={handleSaveProjects} disabled={saveProjectsMutation.isPending}>
              {saveProjectsMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
