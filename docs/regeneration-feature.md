# Response Regeneration Feature

This document explains how the response regeneration feature is implemented and handled in the chat application.

## Overview

The regeneration feature allows users to regenerate any assistant response in a conversation. When triggered, it:
1. Clears the existing response content
2. Sends the conversation history (up to the user message) to the AI
3. Streams the new response in place of the old one
4. Updates the database with the new content (same message ID)

## Why Custom Implementation?

The AI SDK's `useChat` hook handles normal message sending and streaming automatically. However, regeneration has unique requirements:

1. **In-place update**: The message must stay at its original position in the conversation
2. **Same ID**: We keep the same message ID to avoid UI disruption and maintain associations (e.g., shared links)
3. **Targeted regeneration**: Users can regenerate any response, not just the last one
4. **Context preservation**: Only messages up to the target user input are sent to the AI

The `useChat` hook's built-in `reload()` function only regenerates the last message and doesn't support these requirements, so we implemented custom streaming logic.

## Architecture

### Files Involved

- `src/features/chat/components/chat-view.tsx` - Main chat component with `handleRegenerate` function
- `src/features/chat/components/chat-messages-virtual.tsx` - Message rendering with regeneration UI state
- `src/routes/api/conversations/$id.messages.ts` - PATCH endpoint for updating message content
- `src/routes/api/chat.ts` - Chat API that streams AI responses

### State Management

```typescript
// In chat-view.tsx
const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null)
```

This state tracks which message is being regenerated. It's used to:
- Show loading dots on the regenerating message
- Hide action icons on all messages during streaming
- Determine when streaming is complete

## Implementation Details

### 1. Triggering Regeneration

When the user clicks the regenerate button on an assistant message:

```typescript
// chat-messages-virtual.tsx
<MessageAction 
  icon={Refresh01Icon} 
  onClick={() => onReload?.(message.id)} 
  tooltip="Regenerate" 
/>
```

### 2. handleRegenerate Function (chat-view.tsx)

The main regeneration logic:

```typescript
const handleRegenerate = useCallback(async (assistantMessageId: string) => {
  // 1. Find the assistant message and its preceding user message
  const assistantIndex = messages.findIndex((m) => m.id === assistantMessageId)
  const userIndex = /* find user message before assistantIndex */
  
  // 2. Set regenerating state (shows loading UI)
  setRegeneratingMessageId(assistantMessageId)
  
  // 3. If message was shared, unshare first
  if (sharedMessageMap.get(assistantMessageId)) {
    await handleUnshareMessage(shareId)
  }
  
  // 4. Clear content in UI (keep same ID, clear metadata)
  setMessages((prev) => {
    const updated = [...prev]
    updated[assistantIndex] = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      parts: [{ type: 'text', text: '' }],
      metadata: undefined, // Clear old usage data
    }
    return updated
  })
  
  // 5. Prepare messages for AI (up to and including user message)
  const messagesForAI = messages.slice(0, userIndex + 1).map(...)
  
  // 6. Call /api/chat and stream response
  const response = await fetch('/api/chat', { ... })
  
  // 7. Parse SSE stream and update message in place
  // (see Stream Parsing section below)
  
  // 8. Persist to IndexedDB and server
  await db.updateMessage(assistantMessageId, { content: fullContent })
  fetch(`/api/conversations/${conversationId}/messages?messageId=${assistantMessageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content: fullContent }),
  })
  
  // 9. Clear regenerating state
  setRegeneratingMessageId(null)
}, [...])
```

### 3. Stream Parsing

The AI SDK returns Server-Sent Events (SSE) format:

```
data: {"type":"start"}
data: {"type":"text-delta","id":"0","delta":"Hello"}
data: {"type":"text-delta","id":"0","delta":" world"}
data: {"type":"text-end","id":"0"}
data: {"type":"finish","finishReason":"stop",...}
```

Parsing logic:

```typescript
const reader = response.body.getReader()
const decoder = new TextDecoder()
let fullContent = ''
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop() || '' // Keep incomplete line
  
  for (const line of lines) {
    if (!line.trim()) continue
    // Strip "data: " prefix (SSE format)
    const jsonStr = line.startsWith('data: ') ? line.slice(6) : line
    if (!jsonStr.trim() || jsonStr === '[DONE]') continue
    
    const parsed = JSON.parse(jsonStr)
    if (parsed.type === 'text-delta' && parsed.delta) {
      fullContent += parsed.delta
      // Update message in UI
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === assistantMessageId)
        if (idx === -1) return prev
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          content: fullContent,
          parts: [{ type: 'text', text: fullContent }],
        }
        return updated
      })
    }
  }
}
```

### 4. UI State During Regeneration

In `chat-messages-virtual.tsx`:

```typescript
// Streaming when: normal loading OR regenerating
const isStreaming = (isLoading && lastMessage?.role === 'assistant') || !!regeneratingMessageId

// Show loading dots for regenerating message with empty content
{regeneratingMessageId === message.id && !text ? (
  <span className="animate-pulse">●●●</span>
) : (
  <Streamdown>{text}</Streamdown>
)}

// Hide action icons during any streaming
{!isStreaming && (
  <div className="flex items-center gap-0.5">
    {/* action icons */}
  </div>
)}
```

### 5. Server-Side Update

The PATCH endpoint in `$id.messages.ts`:

```typescript
PATCH: async ({ params, request }) => {
  const messageId = url.searchParams.get('messageId')
  const { content } = await request.json()
  
  await db.update(messages)
    .set({ content })
    .where(and(
      eq(messages.id, messageId),
      eq(messages.conversationId, params.id),
    ))
  
  await invalidateOnNewMessage(params.id) // Clear cache
  return new Response(null, { status: 204 })
}
```

## Why UPDATE Instead of DELETE/INSERT?

Initially, we tried deleting the old message and creating a new one. This caused several issues:

1. **Position shifts**: New messages were appended to the end instead of staying in place
2. **ID changes**: New IDs broke associations with shared links
3. **UI flickering**: Delete/insert caused visible DOM changes
4. **Duplicate messages**: Race conditions between delete and insert

The UPDATE approach solves all these:
- Same ID = same position in array
- No need to update shared message associations
- Smooth transition from loading → streaming → complete
- Single atomic database operation

## Comparison: Normal Chat vs Regeneration

| Aspect | Normal Chat (`useChat`) | Regeneration (Custom) |
|--------|------------------------|----------------------|
| Message creation | Automatic by SDK | Manual via PATCH |
| Streaming | Handled by SDK | Manual SSE parsing |
| Message ID | Generated by SDK | Kept same |
| Position | Appended to end | In-place update |
| State tracking | `status` from SDK | `regeneratingMessageId` |
| UI update | Automatic | Manual `setMessages` |

## Key Learnings

1. **SSE format**: The stream has `data: ` prefix before JSON - must strip it
2. **Buffer handling**: Chunks can arrive split mid-line - use buffer
3. **Index vs ID**: Use message ID for lookups, not array index (which can change)
4. **Metadata clearing**: Clear old usage/cost metadata when regenerating
5. **State cleanup**: Always clear `regeneratingMessageId` in `finally` block
