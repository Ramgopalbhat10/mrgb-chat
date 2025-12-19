// Cache key conventions for Redis
// TTL values in seconds

export const CACHE_TTL = {
  CONVERSATION_LIST: 60, // 1 minute
  CONVERSATION: 300, // 5 minutes
  MESSAGES_PAGE: 300, // 5 minutes
  PROJECT_LIST: 300, // 5 minutes
  PROJECT: 600, // 10 minutes
} as const

export const cacheKeys = {
  // Conversation keys
  conversationList: (cursor?: string) =>
    cursor ? `conv:list:${cursor}` : 'conv:list:recent',

  conversation: (id: string) => `conv:${id}`,

  conversationMessages: (conversationId: string, cursor?: string) =>
    cursor
      ? `conv:${conversationId}:msgs:${cursor}`
      : `conv:${conversationId}:msgs:latest`,

  // Project keys
  projectList: () => 'project:list',

  project: (id: string) => `project:${id}`,

  projectConversations: (projectId: string) => `project:${projectId}:convs`,

  // Session keys
  session: (sessionId: string) => `session:${sessionId}`,

  // User keys
  user: (userId: string) => `user:${userId}`,
} as const

// Helper to invalidate related keys
export const invalidationPatterns = {
  onNewMessage: (conversationId: string) => [
    cacheKeys.conversationList(),
    cacheKeys.conversation(conversationId),
    `conv:${conversationId}:msgs:*`,
  ],

  onConversationUpdate: (conversationId: string) => [
    cacheKeys.conversationList(),
    cacheKeys.conversation(conversationId),
  ],

  onConversationDelete: (conversationId: string) => [
    cacheKeys.conversationList(),
    cacheKeys.conversation(conversationId),
    `conv:${conversationId}:*`,
  ],

  onProjectUpdate: (projectId: string) => [
    cacheKeys.projectList(),
    cacheKeys.project(projectId),
  ],
} as const
