import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChatHeader, ConversationList } from '@/features/chat/components'
import { conversationsQueryOptions, projectsMetadataQueryOptions } from '@/features/chat/data/queries'

export const Route = createFileRoute('/chats')({
  component: ChatsPage,
  head: () => ({
    meta: [{ title: 'MRGB Chat | Chats' }],
  }),
})

function ChatsPage() {
  const { data: conversations = [] } = useQuery(conversationsQueryOptions())
  const { data: projectsMetadata } = useQuery(projectsMetadataQueryOptions())

  // Filter out archived conversations
  const visibleConversations = conversations.filter((c) => !c.archived)

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader title="Chats" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <ConversationList
            conversations={visibleConversations}
            title="Your Chats"
            showProjectBadges={true}
            projects={projectsMetadata?.projects ?? []}
            conversationProjects={projectsMetadata?.conversationProjects ?? {}}
          />
        </div>
      </div>
    </div>
  )
}
