import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Message01Icon, UserIcon, AiBrain01Icon } from '@hugeicons/core-free-icons'
import { Streamdown } from 'streamdown'
import { CollapsibleCodeBlocks } from '@/components/collapsible-code-blocks'

interface SharedMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface SharedConversation {
  id: string
  title: string
  createdAt: string
}

interface ShareData {
  conversation: SharedConversation
  messages: SharedMessage[]
}

export const Route = createFileRoute('/share/$id')({
  component: SharedConversationPage,
})

function SharedConversationPage() {
  const { id } = Route.useParams()
  const [data, setData] = useState<ShareData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSharedConversation()
  }, [id])

  const fetchSharedConversation = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/conversations/${id}/share`)
      if (!response.ok) {
        if (response.status === 404) {
          setError('This conversation is not available or has not been shared.')
        } else {
          setError('Failed to load conversation.')
        }
        return
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Failed to fetch shared conversation:', err)
      setError('Failed to load conversation.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
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
          Conversation not found
        </h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          {error || 'This conversation does not exist or is no longer shared.'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <h1 className="text-sm font-medium text-foreground truncate">
            {data.conversation.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            Shared conversation • {new Date(data.conversation.createdAt).toLocaleDateString()}
          </p>
        </div>
      </header>

      {/* Messages */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {data.messages.map((message) => (
            <div key={message.id} className="flex gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                message.role === 'user' 
                  ? 'bg-primary/10' 
                  : 'bg-muted'
              }`}>
                <HugeiconsIcon
                  icon={message.role === 'user' ? UserIcon : AiBrain01Icon}
                  size={16}
                  strokeWidth={2}
                  className={message.role === 'user' ? 'text-primary' : 'text-muted-foreground'}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground mb-1">
                  {message.role === 'user' ? 'User' : 'Assistant'}
                </div>
                {message.role === 'user' ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {message.content}
                  </p>
                ) : (
                  <CollapsibleCodeBlocks className="prose prose-sm prose-invert max-w-none text-foreground">
                    <Streamdown>{message.content}</Streamdown>
                  </CollapsibleCodeBlocks>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
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
