// Cache key conventions for Redis
// TTL values in seconds

export const CACHE_TTL = {
  CONVERSATION_TITLES: 120, // 2 minutes - sidebar list
  MESSAGE_PREVIEW: 300, // 5 minutes - first message pair per conversation
  PROJECT_LIST: 300, // 5 minutes - projects with counts
  SHARED_ITEMS: 300, // 5 minutes - shared conversations and responses
  CACHE_VERSION: 0, // No TTL - version number for ETag validation
} as const

// Type for cached conversation title
export interface ConversationTitle {
  id: string
  title: string
  createdAt?: string
  lastMessageAt: string | null
  starred?: boolean
  archived?: boolean
  isPublic?: boolean
  revision?: number
}

// Type for cached project with count
export interface CachedProject {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  conversationCount: number
}

// Type for cached shared items
export interface CachedSharedItems {
  conversations: Array<{
    id: string
    title: string
    createdAt: string
    lastMessageAt: string | null
  }>
  responses: Array<{
    id: string
    userInput: string
    response: string
    originalMessageId: string | null
    conversationId: string | null
    createdAt: string
  }>
}

export const cacheKeys = {
  // Sidebar: lightweight list of {id, title, lastMessageAt, starred, archived}
  conversationTitles: () => 'conv:titles',

  // Message preview: first user message + assistant response
  messagePreview: (conversationId: string) => `conv:${conversationId}:preview`,

  // Project keys
  projectList: () => 'project:list',
  projectMetadata: () => 'project:metadata', // Full metadata with conversation mappings
  projectConversations: (projectId: string) => `project:${projectId}:convs`,
  
  // Shared items
  sharedItems: () => 'shared:items',
  
  // Cache version for ETag-like validation
  // Incremented on any data mutation to signal clients to refresh
  cacheVersion: () => 'cache:version',
} as const

// Cache invalidation patterns
export const invalidationKeys = {
  onConversationCreate: () => [
    cacheKeys.conversationTitles(),
  ],

  onConversationUpdate: (conversationId: string) => [
    cacheKeys.conversationTitles(),
    cacheKeys.messagePreview(conversationId),
    cacheKeys.sharedItems(), // May affect shared conversations
  ],

  onConversationDelete: (conversationId: string) => [
    cacheKeys.conversationTitles(),
    cacheKeys.messagePreview(conversationId),
    cacheKeys.projectList(), // Conversation counts may change
    cacheKeys.projectMetadata(), // Full metadata with counts
    cacheKeys.sharedItems(), // May have shared items from this conversation
  ],

  onNewMessage: (conversationId: string) => [
    cacheKeys.conversationTitles(), // Update lastMessageAt
    cacheKeys.messagePreview(conversationId), // May update first messages
  ],

  onTitleGenerated: () => [
    cacheKeys.conversationTitles(),
    cacheKeys.sharedItems(), // Title shown in shared conversations
  ],
  
  onProjectChange: () => [
    cacheKeys.projectList(),
    cacheKeys.projectMetadata(),
  ],
  
  onSharedItemChange: () => [
    cacheKeys.sharedItems(),
  ],
} as const
