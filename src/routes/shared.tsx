import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChatHeader } from '@/features/chat/components'
import { useUpdateConversation } from '@/features/chat/data/mutations'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Share01Icon,
  Globe02Icon,
  BubbleChatIcon,
  LockIcon,
} from '@hugeicons/core-free-icons'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { sharedKeys, sharedItemsQueryOptions } from '@/features/chat/data/queries'

export const Route = createFileRoute('/shared')({
  component: SharedPage,
  head: () => ({
    meta: [{ title: 'MRGB Chat | Shared' }],
  }),
})

function SharedPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const updateConversation = useUpdateConversation()
  const [deleteItem, setDeleteItem] = useState<{ id: string; type: 'conversation' | 'response' } | null>(null)

  // Fetch shared items using TanStack Query (cached)
  const { data: sharedData, isLoading } = useQuery(sharedItemsQueryOptions())

  // Remove from public mutation
  const removeMutation = useMutation({
    mutationFn: async (item: { id: string; type: 'conversation' | 'response' }) => {
      if (item.type === 'conversation') {
        await updateConversation.mutateAsync({
          id: item.id,
          updates: { isPublic: false },
        })
      } else {
        const res = await fetch(`/api/share?id=${item.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to delete shared response')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharedKeys.all })
      setDeleteItem(null)
    },
  })

  const handleRemoveFromPublic = () => {
    if (!deleteItem) return
    removeMutation.mutate(deleteItem)
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
                <div className="flex flex-col gap-2">
                  {sharedData.conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="group relative w-full text-left px-4 py-3 rounded-md hover:bg-accent/40 cursor-pointer transition-colors"
                      onClick={() => handleNavigateToSource(conv.id, null)}
                    >
                      <div className="flex items-center gap-3">
                      <HugeiconsIcon
                        icon={Globe02Icon}
                        size={16}
                        strokeWidth={2}
                        className="text-muted-foreground/60 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm text-foreground truncate">
                          {conv.title}
                        </h3>
                        <div className="text-xs text-muted-foreground/70 mt-0.5">
                          {new Date(conv.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {/* Inline action icons */}
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger render={
                            <button
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              onClick={() => handleOpenPublicLink(conv.id, 'conversation')}
                            >
                              <HugeiconsIcon icon={Globe02Icon} size={14} strokeWidth={2} />
                            </button>
                          } />
                          <TooltipContent side="bottom">Open public link</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger render={
                            <button
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              onClick={() => setDeleteItem({ id: conv.id, type: 'conversation' })}
                            >
                              <HugeiconsIcon icon={LockIcon} size={14} strokeWidth={2} />
                            </button>
                          } />
                          <TooltipContent side="bottom">Make private</TooltipContent>
                        </Tooltip>
                      </div>
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
                    icon={BubbleChatIcon}
                    size={16}
                    strokeWidth={2}
                    className="text-muted-foreground"
                  />
                  <span className="text-sm text-muted-foreground">
                    {sharedData.counts.responses} response{sharedData.counts.responses !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {sharedData.responses.map((item) => (
                    <div
                      key={item.id}
                      className="group relative w-full text-left px-4 py-3 rounded-md hover:bg-accent/40 cursor-pointer transition-colors"
                      onClick={() => item.conversationId && handleNavigateToSource(item.conversationId, item.originalMessageId)}
                    >
                      <div className="flex items-center gap-3">
                      <HugeiconsIcon
                        icon={BubbleChatIcon}
                        size={16}
                        strokeWidth={2}
                        className="text-muted-foreground/60 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm text-foreground truncate">
                          {item.userInput}
                        </h3>
                        <div className="text-xs text-muted-foreground/70 mt-0.5">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {/* Inline action icons */}
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger render={
                            <button
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              onClick={() => handleOpenPublicLink(item.id, 'response')}
                            >
                              <HugeiconsIcon icon={Globe02Icon} size={14} strokeWidth={2} />
                            </button>
                          } />
                          <TooltipContent side="bottom">Open public link</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger render={
                            <button
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              onClick={() => setDeleteItem({ id: item.id, type: 'response' })}
                            >
                              <HugeiconsIcon icon={LockIcon} size={14} strokeWidth={2} />
                            </button>
                          } />
                          <TooltipContent side="bottom">Make private</TooltipContent>
                        </Tooltip>
                      </div>
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
              {removeMutation.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
