import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAppStore } from '@/stores/app-store'
import { ChatHeader, ConversationList } from '@/features/chat/components'

interface Project {
  id: string
  name: string
}

export const Route = createFileRoute('/chats')({
  component: ChatsPage,
})

function ChatsPage() {
  const conversations = useAppStore((state) => state.conversations)
  const [projects, setProjects] = useState<Project[]>([])
  const [conversationProjects, setConversationProjects] = useState<
    Record<string, string[]>
  >({})

  useEffect(() => {
    fetchProjectsData()
  }, [])

  const fetchProjectsData = async () => {
    try {
      const res = await fetch('/api/projects/metadata')
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects)
        setConversationProjects(data.conversationProjects)
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    }
  }

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
            projects={projects}
            conversationProjects={conversationProjects}
            onProjectsChanged={fetchProjectsData}
          />
        </div>
      </div>
    </div>
  )
}
