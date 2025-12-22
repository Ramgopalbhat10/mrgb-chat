// Cache key conventions for Redis
// TTL values in seconds

export const CACHE_TTL = {
  CONVERSATION_TITLES: 120, // 2 minutes - sidebar list
  MESSAGE_PREVIEW: 300, // 5 minutes - first message pair per conversation
  PROJECT_LIST: 300, // 5 minutes
} as const

export const cacheKeys = {
  // Sidebar: lightweight list of {id, title, lastMessageAt}
  conversationTitles: () => 'conv:titles',

  // Message preview: first user message + assistant response
  messagePreview: (conversationId: string) => `conv:${conversationId}:preview`,

  // Project keys
  projectList: () => 'project:list',
  projectConversations: (projectId: string) => `project:${projectId}:convs`,
} as const

// Cache invalidation patterns
export const invalidationKeys = {
  onConversationCreate: () => [cacheKeys.conversationTitles()],

  onConversationUpdate: (conversationId: string) => [
    cacheKeys.conversationTitles(),
    cacheKeys.messagePreview(conversationId),
  ],

  onConversationDelete: (conversationId: string) => [
    cacheKeys.conversationTitles(),
    cacheKeys.messagePreview(conversationId),
  ],

  onNewMessage: (conversationId: string) => [
    cacheKeys.conversationTitles(), // Update lastMessageAt
    cacheKeys.messagePreview(conversationId), // May update first messages
  ],

  onTitleGenerated: () => [cacheKeys.conversationTitles()],
} as const
