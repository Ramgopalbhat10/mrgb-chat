# Issue 8 — Web Search Toggle Infinite Loop + New-Chat Empty View

## Type
- bug

## Status
- resolved

## Related Story
- Story 1 — Web Search Integration with Parallel Provider

## Description
- Two regressions introduced while adding web search persistence: (1) the search toggle flickered rapidly on reload and the console flooded with `flushSync was called from inside a lifecycle method` errors; (2) after sending the first message from `/new`, the `/chat/$id` view stayed on the empty-chat screen even though the title was generated and the URL updated.

## Root Cause
1. **Infinite loop** — `chat-view.tsx` added a `webSearchEnabled` persist effect whose deps included `conversation` (the object from `conversations.find`). The effect called `updateConversationCache`, which spread `conversation` into a new object reference, which changed the `conversation` dep, which re-triggered the effect — an unbounded loop. This caused cascading flushSync re-renders and state corruption that cleared `chatMessages`.
2. **New-chat handoff broken** — `chat.$id.tsx` was changed to call `consumePendingNewChat()` (which atomically reads-and-clears the store). React StrictMode double-invokes effects in development: the second invocation found `pendingNewChat` already null (cleared by the first run), so `setPendingMessage` was never called with the initial message, leaving `ChatView` with no messages to render.

## Fix / Approach
1. `chat-view.tsx` persist effect: removed `conversation` from deps; removed the `updateConversationCache` call (write only to IndexedDB); added an `isFirstWebSearchPersistRef` guard so the effect skips the initial render and only fires on real user toggles.
2. `chat-view.tsx` load effect: added `hasLoadedWebSearchRef` guard so the effect only runs once, preventing any future load→persist feedback.
3. `chat.$id.tsx`: re-subscribed to `pendingNewChat` so the effect is reactive to store updates; moved `consumePendingNewChat()` inside the guard (after capturing values), keeping the `hasConsumedPending` ref to survive StrictMode double-invocation.

## Files Changed
- `src/features/chat/components/chat/chat-view.tsx`
- `src/routes/chat.$id.tsx`

## Dev Log

| Date | Unit | Summary |
|---|---|---|
| 2026-05-08 | fix | Fixed webSearch persist-effect infinite loop (removed `conversation` dep + `updateConversationCache` call, added first-render guard). Restored reactive `pendingNewChat` subscription in `chat.$id.tsx` with in-guard consume to fix empty view after first message. |

## Test Plan
- Send a message from `/new` with search toggle ON → `/chat/$id` shows the user message and streams the assistant reply.
- Reload the same `/chat/$id` → toggle state is correct, no flickering, no flushSync errors in console.
- Toggle search ON and OFF → IndexedDB is updated; reload confirms persistence.
- `bun run lint` and `bun run build` pass.

## Definition of Done
- Fix verified (lint + build pass). ✓
- Status set to `resolved`. ✓
- Dev Log updated. ✓
- Progress updated in `docs/PROGRESS.md`. ✓
- Story 1 Issues section updated. ✓

## References
- Story 1: `docs/stories/story-1.md`
