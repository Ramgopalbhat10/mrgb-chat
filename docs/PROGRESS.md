# Progress

## Goal 01
- Move server state (conversations/messages) to TanStack Query with IndexedDB hydration; keep Zustand for UI-only state.
- Add server-side revisions + cache-version polling to fix cross-device staleness and missing messages.

## Changes (by area)

### Server + DB
- Added revision columns for conversations/messages: `src/server/db/schema.ts`, `src/server/db/migrations/0005_add_revisions.sql`.
- Conversation list API now paginates on `coalesce(lastMessageAt, createdAt)` and returns `createdAt` for cache stability: `src/routes/api/conversations/index.ts`.
- Conversation updates now bump revision: `src/routes/api/conversations/$id.ts`.
- Message endpoints now support `limit`/`after` and bump revisions + cache version on POST/PATCH/DELETE: `src/routes/api/conversations/$id.messages.ts`.
- Cache title type updated to include `createdAt` and `revision`: `src/server/cache/keys.ts`.

### Client state refactor
- Zustand trimmed to UI-only state (active conversation, pending new chat, title loading, hydration): `src/stores/app-store.ts`.
- New query/persistence layer for conversations/messages + IndexedDB hydration: `src/features/chat/data/queries.ts`, `src/features/chat/data/persistence.ts`.
- Added cache-version polling + invalidation (conversations/messages/projects/shared): `src/features/chat/hooks/use-cache-version-sync.ts`.

### UI wiring updates
- Root layout now hydrates query cache and uses polling: `src/routes/__root.tsx`.
- Chat route now uses query-based message loading + hydration: `src/routes/chat.$id.tsx`.
- Chats/projects/shared/new routes updated to use query/mutations: `src/routes/chats.tsx`, `src/routes/project.$id.tsx`, `src/routes/shared.tsx`, `src/routes/new.tsx`.
- Chat view now reads conversations via query and updates query caches on message persistence: `src/features/chat/components/chat/chat-view.tsx`.
- Conversation actions/bulk delete now use query mutations: `src/features/chat/components/conversations/conversation-actions-dropdown.tsx`, `src/features/chat/components/conversations/conversation-list.tsx`.

### Cleanup
- Removed legacy Zustand/TanStack hook file and duplicate chat route: `src/features/chat/hooks/use-conversations.ts`, `src/routes/chat..tsx`.

## Notes
- Full message history is now fetched via paged requests (oldest-first) and persisted to IndexedDB.
- Cross-device changes now trigger query invalidation via `/api/cache-version` polling.
