import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { Message01Icon, UserIcon, AiBrain01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Streamdown } from 'streamdown'
import { CollapsibleCodeBlocks } from '@/components/collapsible-code-blocks'
import { useEffect } from 'react'

export const Route = createFileRoute('/s/$id')({
  component: SharedMessagePage,
})

function SharedMessagePage() {
  const { id } = Route.useParams()

  const { data: shared, isLoading, error } = useQuery({
    queryKey: ['shared-message', id],
    queryFn: async () => {
      const response = await fetch(`/api/share?id=${id}`)
      if (!response.ok) {
        throw new Error('Shared message not found')
      }
      return response.json()
    },
  })

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.title = shared?.userInput?.slice(0, 100) || 'Shared Response'
  }, [shared?.userInput])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !shared) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <HugeiconsIcon
            icon={Message01Icon}
            size={24}
            strokeWidth={2}
            className="text-muted-foreground"
          />
        </div>
        <h1 className="text-lg font-medium text-foreground mb-2">
          Response not found
        </h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          This shared response does not exist or is no longer available.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/'}>
          Go Home
        </Button>
      </div>
    )
  }

  // Format the date from createdAt
  const formattedDate = shared.createdAt 
    ? new Date(shared.createdAt).toLocaleDateString()
    : new Date().toLocaleDateString()

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Full width, matching conversation style */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <h1 className="text-sm font-medium text-foreground truncate">
            {shared.userInput?.slice(0, 100) || 'Shared Response'}
          </h1>
          <p className="text-xs text-muted-foreground">
            Shared response • {formattedDate}
          </p>
        </div>
      </header>

      {/* Messages - Same layout as conversation */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* User Message */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary/10">
              <HugeiconsIcon
                icon={UserIcon}
                size={16}
                strokeWidth={2}
                className="text-primary"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground mb-1">User</div>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {shared.userInput}
              </p>
            </div>
          </div>

          {/* Assistant Response */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-muted">
              <HugeiconsIcon
                icon={AiBrain01Icon}
                size={16}
                strokeWidth={2}
                className="text-muted-foreground"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground mb-1">Assistant</div>
              <CollapsibleCodeBlocks className="prose prose-sm prose-invert max-w-none text-foreground">
                <Streamdown>{shared.response}</Streamdown>
              </CollapsibleCodeBlocks>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Full width, matching conversation style */}
      <footer className="border-t border-border py-4 mt-8">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            This is a shared conversation. Some content may have been omitted.
          </p>
        </div>
      </footer>
    </div>
  )
}
