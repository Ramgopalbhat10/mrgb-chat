import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Message01Icon,
  StarIcon,
  Folder01Icon,
  Add01Icon,
  Search01Icon,
  Delete01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'
import { useAppStore } from '@/stores/app-store'
import { ConversationActionsDropdown } from './conversation-actions-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import type { Conversation } from '@/lib/indexeddb'

interface Project {
  id: string
  name: string
}

interface ConversationListProps {
  conversations: Conversation[]
  title: string
  newChatPath?: string
  newChatLabel?: string
  showProjectBadges?: boolean
  projects?: Project[]
  conversationProjects?: Record<string, string[]>
  onProjectsChanged?: () => void
  emptyMessage?: string
  emptyDescription?: string
}

export function ConversationList({
  conversations,
  title,
  newChatPath = '/new',
  newChatLabel = 'New chat',
  showProjectBadges = false,
  projects = [],
  conversationProjects = {},
  onProjectsChanged,
  emptyMessage = 'No conversations yet',
  emptyDescription = 'Start a new chat to begin a conversation.',
}: ConversationListProps) {
  const navigate = useNavigate()
  const deleteConversation = useAppStore((state) => state.deleteConversation)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const getProjectsForConversation = (conversationId: string): Project[] => {
    const projectIds = conversationProjects[conversationId] || []
    return projects.filter((p) => projectIds.includes(p.id))
  }

  const handleSelectConversation = (id: string) => {
    navigate({ to: '/chat/$id', params: { id } })
  }

  // Filter out archived conversations and apply search
  const visibleConversations = useMemo(() => {
    return conversations
      .filter((c) => !c.archived)
      .filter((c) =>
        searchQuery
          ? c.title.toLowerCase().includes(searchQuery.toLowerCase())
          : true
      )
  }, [conversations, searchQuery])

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === visibleConversations.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleConversations.map((c) => c.id)))
    }
  }

  const handleBulkDelete = async () => {
    setIsDeleting(true)
    try {
      for (const id of selectedIds) {
        await deleteConversation(id)
      }
      setSelectedIds(new Set())
      setIsSelectionMode(false)
    } catch (error) {
      console.error('Failed to delete conversations:', error)
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const exitSelectionMode = () => {
    setIsSelectionMode(false)
    setSelectedIds(new Set())
  }

  return (
    <>
      {/* Title and New chat button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">{title}</h2>
        <Button size="sm" onClick={() => navigate({ to: newChatPath })}>
          <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} className="mr-1.5" />
          {newChatLabel}
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50"
          />
          <Input
            placeholder="Search your chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-sm bg-muted/30 border-border/50"
          />
        </div>
      </div>

      {/* Stats and selection controls */}
      <div className="flex items-center justify-between mb-3 text-sm">
        {isSelectionMode ? (
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                selectedIds.size === visibleConversations.length && visibleConversations.length > 0
                  ? 'bg-primary border-primary'
                  : 'border-muted-foreground/50'
              }`}>
                {selectedIds.size === visibleConversations.length && visibleConversations.length > 0 && (
                  <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span>{selectedIds.size} selected</span>
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setIsDeleteDialogOpen(true)}
                className="flex items-center gap-1.5 px-2 py-1 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                <HugeiconsIcon icon={Delete01Icon} size={14} strokeWidth={2} />
                Delete
              </button>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">
            {visibleConversations.length} chat{visibleConversations.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
        )}
        <button
          onClick={isSelectionMode ? exitSelectionMode : () => setIsSelectionMode(true)}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          {isSelectionMode ? (
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
              Cancel
            </span>
          ) : (
            'Select'
          )}
        </button>
      </div>

      {visibleConversations.length === 0 ? (
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
            {searchQuery ? 'No matching chats' : emptyMessage}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {searchQuery
              ? 'Try a different search term.'
              : emptyDescription}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {visibleConversations.map((conversation) => {
            const isSelected = selectedIds.has(conversation.id)
            return (
              <div
                key={conversation.id}
                className={`group relative w-full text-left px-4 py-3 rounded-md hover:bg-accent/40 cursor-pointer transition-colors ${
                  isSelected ? 'bg-accent/30' : ''
                }`}
                onClick={() => {
                  if (isSelectionMode) {
                    toggleSelection(conversation.id)
                  } else {
                    handleSelectConversation(conversation.id)
                  }
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0 flex items-start gap-3">
                    {isSelectionMode ? (
                      <div
                        className={`w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center ${
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/50'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    ) : (
                      <HugeiconsIcon
                        icon={Message01Icon}
                        size={16}
                        strokeWidth={2}
                        className="text-muted-foreground/60 shrink-0 mt-0.5"
                      />
                    )}
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
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground/60">
                          {new Date(conversation.lastMessageAt || conversation.createdAt).toLocaleDateString()}
                        </span>
                        {/* Project badges */}
                        {showProjectBadges && getProjectsForConversation(conversation.id).length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
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
                  </div>
                  {/* Three dots menu - always visible on mobile, hover on desktop */}
                  {!isSelectionMode && (
                    <div
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ConversationActionsDropdown
                        conversation={conversation}
                        side="bottom"
                        align="end"
                        onProjectsChanged={onProjectsChanged}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bulk Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} conversation{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected conversations will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
