import { openDB, type IDBPDatabase } from 'idb'
import { compressString, decompressString } from './compression'

export interface Conversation {
  id: string
  title: string
  modelId?: string
  starred: boolean
  archived: boolean
  isPublic: boolean
  revision?: number
  createdAt: Date
  updatedAt: Date
  lastMessageAt: Date | null
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  clientId: string | null
  metaJson: string | null
  revision?: number
  createdAt: Date
}

export interface Project {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface ConversationProject {
  conversationId: string
  projectId: string
}

const DB_NAME = 'mrgb-chat-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available on the server'))
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Conversations store
        if (!db.objectStoreNames.contains('conversations')) {
          const conversationStore = db.createObjectStore('conversations', {
            keyPath: 'id',
          })
          conversationStore.createIndex('by-lastMessageAt', 'lastMessageAt')
          conversationStore.createIndex('by-starred', 'starred')
        }

        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', {
            keyPath: 'id',
          })
          messageStore.createIndex('by-conversationId', 'conversationId')
          messageStore.createIndex('by-conversationId-createdAt', [
            'conversationId',
            'createdAt',
          ])
        }

        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', {
            keyPath: 'id',
          })
          projectStore.createIndex('by-name', 'name')
        }

        // ConversationProjects store (join table)
        if (!db.objectStoreNames.contains('conversationProjects')) {
          const conversationProjectStore = db.createObjectStore(
            'conversationProjects',
            {
              keyPath: ['conversationId', 'projectId'],
            },
          )
          conversationProjectStore.createIndex(
            'by-conversationId',
            'conversationId',
          )
          conversationProjectStore.createIndex('by-projectId', 'projectId')
        }
      },
    })
  }

  return dbPromise
}

// Conversation operations
export async function getAllConversations(): Promise<Conversation[]> {
  const db = await getDB()
  const conversations = await db.getAllFromIndex(
    'conversations',
    'by-lastMessageAt',
  )
  // Sort by lastMessageAt descending (most recent first)
  return conversations.reverse()
}

export async function getConversation(
  id: string,
): Promise<Conversation | undefined> {
  const db = await getDB()
  return db.get('conversations', id)
}

export async function createConversation(
  conversation: Conversation,
): Promise<Conversation> {
  const db = await getDB()
  await db.put('conversations', conversation)
  return conversation
}

export async function updateConversation(
  id: string,
  updates: Partial<Conversation>,
): Promise<Conversation | undefined> {
  const db = await getDB()
  const existing = await db.get('conversations', id)
  if (!existing) return undefined

  const updated = {
    ...existing,
    ...updates,
    updatedAt: updates.updatedAt ?? new Date(),
  }
  await db.put('conversations', updated)
  return updated
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['conversations', 'messages', 'conversationProjects'],
    'readwrite',
  )

  // Delete the conversation
  await tx.objectStore('conversations').delete(id)

  // Delete all messages for this conversation
  const messageIndex = tx.objectStore('messages').index('by-conversationId')
  let cursor = await messageIndex.openCursor(IDBKeyRange.only(id))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  // Delete all project associations
  const projIndex = tx
    .objectStore('conversationProjects')
    .index('by-conversationId')
  let projCursor = await projIndex.openCursor(IDBKeyRange.only(id))
  while (projCursor) {
    await projCursor.delete()
    projCursor = await projCursor.continue()
  }

  await tx.done
}

// Message operations
export async function getMessagesByConversation(
  conversationId: string,
): Promise<Message[]> {
  const db = await getDB()
  const messages = await db.getAllFromIndex(
    'messages',
    'by-conversationId',
    conversationId,
  )
  // Decompress content and sort by createdAt ascending (oldest first)
  return messages
    .map((msg) => ({
      ...msg,
      content: decompressString(msg.content),
    }))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
}

export async function createMessage(message: Message): Promise<Message> {
  const db = await getDB()

  // Compress content for storage (only for large messages)
  const messageToStore = {
    ...message,
    content: compressString(message.content),
  }

  await db.put('messages', messageToStore)

  // Update conversation's lastMessageAt
  const conversation = await db.get('conversations', message.conversationId)
  if (conversation) {
    await db.put('conversations', {
      ...conversation,
      lastMessageAt: message.createdAt,
      updatedAt: message.createdAt,
    })
  }

  // Return original uncompressed message
  return message
}

export async function updateMessage(
  id: string,
  updates: Partial<Message>,
): Promise<Message | undefined> {
  const db = await getDB()
  const existing = await db.get('messages', id)
  if (!existing) return undefined

  const updated = { ...existing, ...updates }
  await db.put('messages', updated)
  return updated
}

export async function deleteMessage(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('messages', id)
}

// Project operations
export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB()
  return db.getAll('projects')
}

export async function createProject(project: Project): Promise<Project> {
  const db = await getDB()
  await db.put('projects', project)
  return project
}

export async function updateProject(
  id: string,
  updates: Partial<Project>,
): Promise<Project | undefined> {
  const db = await getDB()
  const existing = await db.get('projects', id)
  if (!existing) return undefined

  const updated = { ...existing, ...updates, updatedAt: new Date() }
  await db.put('projects', updated)
  return updated
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['projects', 'conversationProjects'], 'readwrite')

  await tx.objectStore('projects').delete(id)

  // Delete all conversation associations
  const index = tx.objectStore('conversationProjects').index('by-projectId')
  let cursor = await index.openCursor(IDBKeyRange.only(id))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  await tx.done
}

// Conversation-Project associations
export async function addConversationToProject(
  conversationId: string,
  projectId: string,
): Promise<void> {
  const db = await getDB()
  await db.put('conversationProjects', { conversationId, projectId })
}

export async function removeConversationFromProject(
  conversationId: string,
  projectId: string,
): Promise<void> {
  const db = await getDB()
  await db.delete('conversationProjects', [conversationId, projectId])
}

export async function getProjectsForConversation(
  conversationId: string,
): Promise<string[]> {
  const db = await getDB()
  const associations = await db.getAllFromIndex(
    'conversationProjects',
    'by-conversationId',
    conversationId,
  )
  return associations.map((a) => a.projectId)
}

export async function getConversationsForProject(
  projectId: string,
): Promise<string[]> {
  const db = await getDB()
  const associations = await db.getAllFromIndex(
    'conversationProjects',
    'by-projectId',
    projectId,
  )
  return associations.map((a) => a.conversationId)
}

// Bulk operations for hydration
export async function hydrateFromIndexedDB(): Promise<{
  conversations: Conversation[]
  projects: Project[]
}> {
  try {
    const [conversations, projects] = await Promise.all([
      getAllConversations(),
      getAllProjects(),
    ])
    return { conversations, projects }
  } catch {
    // Return empty state if IndexedDB is not available (SSR)
    return { conversations: [], projects: [] }
  }
}
