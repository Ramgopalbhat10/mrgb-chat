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

## Goal 02
- Improve chat UX responsiveness during streaming and heavy markdown rendering.
- Ensure regenerate uses the current model selection from the input every time.
- Reduce UI jank with virtualization and more intentional scroll behavior.

## Goal 02 Changes

### Model selection + regeneration
- Model selection is now controlled from ChatView and passed into ChatInput as a controlled value; regenerate/send always uses the active input model: `src/features/chat/components/chat/chat-view.tsx`, `src/features/chat/components/chat/chat-input.tsx`.

### Streaming performance + rendering
- Streamdown rendering optimized for streaming: static mode for non-streaming messages, memoized message rows, and throttled updates from the chat stream: `src/features/chat/components/messages/chat-message-row/index.tsx`, `src/features/chat/components/chat/chat-view.tsx`.

### Scrolling + animations
- Virtualized message list improvements: smooth scrolling container, scroll-to-bottom indicator, entry animation (stabilized), and resize-observer tuning: `src/features/chat/components/chat/chat-messages-virtual.tsx`, `src/styles.css`.

## Goal 03
- Fix chat UX regressions (duplicate first message and scroll behavior during regeneration/stream completion).

## Goal 03 Changes

### Message identity + persistence
- User message IDs are now generated upfront and passed to `useChat` for send/pending flows to prevent duplicate user messages during the first send: `src/features/chat/components/chat/chat-view.tsx`.

### Scroll indicator + anchoring
- Scroll-to-bottom indicator now recalculates on content changes and hides when no overflow; scroll anchoring preserves the reader's position when streaming completes: `src/features/chat/components/chat/chat-messages-virtual.tsx`.
- Auto-scroll now locks only when the user stays at the bottom; size-change adjustments are disabled when the user scrolls away to prevent drift during streaming/regeneration: `src/features/chat/components/chat/chat-messages-virtual.tsx`.

## Goal 04
- Add a regeneration action popover with a system-prompt input, expand/concise actions, and per-regeneration model switching without changing the chat input model.

## Goal 04 Changes

### Regenerate actions popup
- Replace the regenerate icon action with a sectioned popover that includes a system instruction input, try again, expand/concise actions, and a per-regeneration model switch row that opens a model list on click: `src/features/chat/components/messages/chat-message-row/index.tsx`.

### Regeneration request handling
- Extend regenerate requests to carry optional system instructions, expansion/concise modes, and model overrides without affecting the active input model: `src/features/chat/components/chat/chat-view.tsx`, `src/routes/api/chat.ts`.

### Regeneration model selector enhancements
- Memoize the shared model selector, support custom triggers and placement, and add a sticky search header with tag filtering chips to speed regeneration model choice: `src/features/chat/components/chat/model-selector.tsx`.
- Replace the filter list toggle with an accordion-driven tag panel, include a filter icon with selected-count badge, and hide the tags on outside click with smooth expand/collapse: `src/features/chat/components/chat/model-selector.tsx`, `src/components/ui/accordion.tsx`.

## Goal 05
- Add route-aware document titles for chats/projects/shared and introduce a theme-aligned SVG favicon for the app.

## Goal 05 Changes

### Document titles
- Set static titles for `/new`, `/chats`, `/projects`, and `/shared`, plus dynamic titles for chat and project detail pages based on conversation/project names: `src/routes/new.tsx`, `src/routes/chats.tsx`, `src/routes/projects.tsx`, `src/routes/shared.tsx`, `src/features/chat/components/chat/chat-view.tsx`, `src/routes/project.$id.tsx`.

### Favicon
- Add a green/gray chat-themed SVG favicon and wire it into the root document links: `public/favicon.svg`, `src/routes/__root.tsx`.

## Goal 06
- Add a user-message navigator dropdown to jump to any user prompt with smooth scrolling in the virtualized chat list, optimized for mobile, tablet, and desktop layouts.

## Goal 06 Changes

### Message navigator
- Added a user-message jump menu in the chat header with numbered previews and smooth scroll targeting in the virtualized list: `src/features/chat/components/chat/user-message-jump-menu.tsx`, `src/features/chat/components/chat/chat-header.tsx`, `src/features/chat/components/chat/chat-view.tsx`, `src/features/chat/components/chat/chat-messages-virtual.tsx`.

## Goal 07
- Add an on-demand "Related" suggestions panel that appears after streaming completes, with a skeleton loading state and click-to-send behavior.
- Wire suggestion generation to `ChatView` lifecycle events (stream finish + reload) without persisting suggestions to IndexedDB, DB, or caches.
- Render suggestions within the virtualized message list so they scroll with responses and respect the chat layout.
- Introduce `/api/suggestions` using AI SDK structured output, with code blocks removed from the user/assistant context before generating prompts.

## Goal 08
- Add assistant-only branching that copies chat history up to a selected response into a new conversation that appears as a fresh, recent chat.

## Goal 08 Changes

### Branching UI + client persistence
- Added a "Branch from here" action on assistant messages and wired it to create a new conversation with copied messages in cache + IndexedDB before navigating: `src/features/chat/components/messages/chat-message-row/index.tsx`, `src/features/chat/components/chat/chat-messages-virtual.tsx`, `src/features/chat/components/chat/chat-view.tsx`.
- Added a branch indicator footer anchored after the branched assistant message (not the end of the chat) and a branch icon marker in sidebar lists: `src/features/chat/components/chat/chat-messages-virtual.tsx`, `src/features/chat/components/chat/chat-view.tsx`, `src/features/chat/components/conversations/conversation-list.tsx`, `src/components/app-sidebar.tsx`.
- Added extra spacing around the branch footer to separate it from the next user message: `src/features/chat/components/chat/chat-messages-virtual.tsx`.

### Server branch endpoint
- Added a dedicated branch endpoint that validates the pivot assistant message and copies messages into a new conversation in a single transaction: `src/routes/api/conversations/$id.branch.ts`.
- Added forked-from metadata fields on conversations to track branch lineage in storage and caches: `src/server/db/schema.ts`, `src/server/db/migrations/0006_add_conversation_branching.sql`, `src/routes/api/conversations/index.ts`, `src/lib/indexeddb.ts`.
- Ensured branched message copies preserve deterministic ordering by spacing createdAt timestamps by 1s and storing the copied pivot message id for anchoring: `src/features/chat/components/chat/chat-view.tsx`, `src/routes/api/conversations/$id.branch.ts`.
