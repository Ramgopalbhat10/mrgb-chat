import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ChatHeader } from '@/features/chat/components'
import { useAppStore } from '@/stores/app-store'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Share01Icon,
  Globe02Icon,
  Message01Icon,
  Link01Icon,
  LockIcon,
  MoreHorizontalIcon,
} from '@hugeicons/core-free-icons'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface SharedConversation {
  id: string
  type: 'conversation'
  title: string
  conversationId: string
  createdAt: string
  updatedAt: string
}

interface SharedResponse {
  id: string
  type: 'response'
  title: string
  originalMessageId: string | null
  conversationId: string | null
  userInput: string
  response: string
  modelId: string | null
  createdAt: string
}

interface SharedData {
  conversations: SharedConversation[]
  responses: SharedResponse[]
  counts: {
    responses: number
    conversations: number
    total: number
  }
}

export const Route = createFileRoute('/shared')({
  component: SharedPage,
})

function SharedPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const updateConversation = useAppStore((state) => state.updateConversation)
  const [sharedData, setSharedData] = useState<SharedData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteItem, setDeleteItem] = useState<{ id: string; type: 'conversation' | 'response' } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchSharedItems()
  }, [])

  const fetchSharedItems = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/share?list=true')
      if (response.ok) {
        const data = await response.json()
        setSharedData(data)
      }
    } catch (error) {
      console.error('Failed to fetch shared items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveFromPublic = async () => {
    if (!deleteItem) return

    setIsDeleting(true)
    try {
      if (deleteItem.type === 'conversation') {
        // For conversations, update isPublic to false
        const response = await fetch(`/api/conversations/${deleteItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublic: false }),
        })
        if (response.ok) {
          // Sync to app store so chat header reflects the change
          await updateConversation(deleteItem.id, { isPublic: false })
          // Invalidate shared-items query cache
          queryClient.invalidateQueries({ queryKey: ['shared-items'] })
          
          setSharedData(prev => {
            if (!prev) return prev
            return {
              ...prev,
              conversations: prev.conversations.filter(c => c.id !== deleteItem.id),
              counts: {
                ...prev.counts,
                conversations: prev.counts.conversations - 1,
                total: prev.counts.total - 1,
              },
            }
          })
        }
      } else {
        // For responses, delete from sharedMessages table
        const response = await fetch(`/api/share?id=${deleteItem.id}`, {
          method: 'DELETE',
        })
        if (response.ok) {
          // Invalidate shared-items query cache so chat view updates
          queryClient.invalidateQueries({ queryKey: ['shared-items'] })
          
          setSharedData(prev => {
            if (!prev) return prev
            return {
              ...prev,
              responses: prev.responses.filter(r => r.id !== deleteItem.id),
              counts: {
                ...prev.counts,
                responses: prev.counts.responses - 1,
                total: prev.counts.total - 1,
              },
            }
          })
        }
      }
      setDeleteItem(null)
    } catch (error) {
      console.error('Failed to remove from public:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenPublicLink = (id: string, type: 'conversation' | 'response') => {
    if (type === 'conversation') {
      window.open(`/share/${id}`, '_blank')
    } else {
      window.open(`/s/${id}`, '_blank')
    }
  }

  const handleNavigateToSource = (conversationId: string, messageId?: string | null) => {
    if (messageId) {
      navigate({ to: '/chat/$id', params: { id: conversationId }, search: { messageId } })
    } else {
      navigate({ to: '/chat/$id', params: { id: conversationId } })
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader title="Shared" />
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !sharedData || sharedData.counts.total === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <HugeiconsIcon
                icon={Share01Icon}
                size={24}
                strokeWidth={2}
                className="text-muted-foreground"
              />
            </div>
            <h2 className="text-lg font-medium text-foreground mb-2">
              No shared items yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Share a conversation or individual response to make it publicly accessible.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg font-medium mb-6">Your Shared Items</h2>

            {/* Shared Conversations Section */}
            {sharedData.conversations.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <HugeiconsIcon
                    icon={Globe02Icon}
                    size={16}
                    strokeWidth={2}
                    className="text-muted-foreground"
                  />
                  <span className="text-sm text-muted-foreground">
                    {sharedData.counts.conversations} conversation{sharedData.counts.conversations !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sharedData.conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="group p-4 rounded-lg border border-border/60 bg-card/50 hover:bg-accent/30 cursor-pointer transition-colors relative"
                      onClick={() => handleNavigateToSource(conv.id, null)}
                    >
                      <div className="flex items-start gap-3">
                        <HugeiconsIcon
                          icon={Globe02Icon}
                          size={18}
                          strokeWidth={2}
                          className="text-muted-foreground/70 shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm text-foreground truncate pr-8">
                            {conv.title}
                          </h3>
                          <div className="text-xs text-muted-foreground/70 mt-1">
                            {new Date(conv.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      {/* Actions dropdown */}
                      <div
                        className="absolute top-3 right-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
                            <HugeiconsIcon icon={MoreHorizontalIcon} size={16} strokeWidth={2} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[160px]">
                            <DropdownMenuItem onClick={() => handleOpenPublicLink(conv.id, 'conversation')}>
                              <HugeiconsIcon icon={Link01Icon} size={14} strokeWidth={2} />
                              <span>Open public link</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteItem({ id: conv.id, type: 'conversation' })}
                            >
                              <HugeiconsIcon icon={LockIcon} size={14} strokeWidth={2} />
                              <span>Make private</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shared Responses Section */}
            {sharedData.responses.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <HugeiconsIcon
                    icon={Message01Icon}
                    size={16}
                    strokeWidth={2}
                    className="text-muted-foreground"
                  />
                  <span className="text-sm text-muted-foreground">
                    {sharedData.counts.responses} response{sharedData.counts.responses !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sharedData.responses.map((item) => (
                    <div
                      key={item.id}
                      className="group p-4 rounded-lg border border-border/60 bg-card/50 hover:bg-accent/30 cursor-pointer transition-colors relative"
                      onClick={() => item.conversationId && handleNavigateToSource(item.conversationId, item.originalMessageId)}
                    >
                      <div className="flex items-start gap-3">
                        <HugeiconsIcon
                          icon={Message01Icon}
                          size={18}
                          strokeWidth={2}
                          className="text-muted-foreground/70 shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm text-foreground truncate pr-8">
                            {item.userInput}
                          </h3>
                          <div className="text-xs text-muted-foreground/70 mt-1">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      {/* Actions dropdown */}
                      <div
                        className="absolute top-3 right-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
                            <HugeiconsIcon icon={MoreHorizontalIcon} size={16} strokeWidth={2} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[160px]">
                            <DropdownMenuItem onClick={() => handleOpenPublicLink(item.id, 'response')}>
                              <HugeiconsIcon icon={Link01Icon} size={14} strokeWidth={2} />
                              <span>Open public link</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteItem({ id: item.id, type: 'response' })}
                            >
                              <HugeiconsIcon icon={LockIcon} size={14} strokeWidth={2} />
                              <span>Make private</span>
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
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from public?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the public share link. The original {deleteItem?.type || 'item'} will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveFromPublic}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
