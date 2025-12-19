# AGENTS.md

This repository is a **personal ChatGPT-like app** built with:

- **Runtime**: Bun
- **Full stack framework**: TanStack Start (React)
- **Query**: TanStack Query (via TanStack Router SSR Query integration)
- **UI**: shadcn/ui (style: `base-nova`) + TailwindCSS v4 + Base UI primitives
- **Icons**: hugeicons
- **AI**: Vercel AI SDK + Vercel AI Gateway
- **Chat UI**: AI SDK UI (framework-agnostic; React hooks like `useChat`)
- **DB**: Turso (libSQL)
- **Cache**: Upstash Redis
- **ORM**: Drizzle

This document is written for an “agentic” workflow: it defines the product requirements, architecture, folder conventions, API shapes, caching strategy (**browser -> Redis -> Turso**), and the milestone plan.

---

## 1) Product requirements (UI/UX)

### Left sidebar

- **Header**
  - Logo (left)
  - Toggle/collapse icon (right)
- **Primary actions/sections**
  - `New chat` CTA button
  - Sidebar nav items:
    - `Chats`
    - `Projects`
  - Each item must have:
    - Icon (left)
    - Label text
- **Recent conversations**
  - Section label: `Conversations`
  - Scrollable list of conversation titles
  - Titles truncate to sidebar width (no wrapping)
  - On hover/selection:
    - Highlight row
    - Show “three dots” menu icon on the right
    - Menu groups:
      - Group 1: `Rename`, `Star`, `Add to project`
      - Group 2: `Delete`
    - Each menu item has an icon to the left
- **Footer**
  - User profile icon (left)
  - Settings icon (right)

### Main section

- **Initial empty state** (app load)
  - Centered chat input
  - Input actions:
    - Attach file
    - Model selection
    - Tool selection (ex: web search)
- **After first user message**
  - Header:
    - Chat title (left)
    - Action icons (right)

### UX requirements (non-negotiable)

- **Optimistic updates everywhere**: creating chats/messages, renaming, starring, adding to project, deleting.
- **Cache-first reads**:
  1) Browser local cache
  2) Redis
  3) Turso
- **Slick feel**:
  - No blocking spinners for typical actions.
  - Use skeletons only for true cold starts.
  - Streaming assistant responses.

---

## 2) Current repository baseline

- Routes live in `src/routes`.
- Root document is `src/routes/__root.tsx` and sets `<html className='dark'>` for dark theme.
- A shadcn/base-ui Sidebar implementation already exists:
  - `src/components/ui/sidebar.tsx`
  - `src/components/app-sidebar.tsx`
  - Current index route wraps the app with `SidebarProvider`:
    - `src/routes/index.tsx`

Scripts (run with Bun):

- `bun run dev` (Vite dev server on port 3000)
- `bun run build`
- `bun run test`
- `bun run lint`
- `bun run format`

Code style:

- Prettier: `semi: false`, `singleQuote: true`.
- ESLint: `@tanstack/eslint-config`.

---

## 3) Proposed folder / module architecture

Keep UI and domain logic separated so the cache-first approach stays testable and consistent.

### Recommended structure

- `src/features/chat/`
  - `components/`
    - `chat-input.tsx`
    - `chat-header.tsx`
    - `conversation-list.tsx`
    - `conversation-row.tsx`
  - `data/`
    - `queries.ts` (TanStack Query keys + query fns)
    - `mutations.ts` (optimistic mutations)
    - `schema.ts` (client-side zod schemas/types if used)
  - `lib/`
    - `cache.ts` (browser cache helpers)
    - `streaming.ts` (stream parsing helpers)

- `src/features/projects/` (similar split)

- `src/server/`
  - `db/`
    - `client.ts` (Turso/libSQL client)
    - `drizzle.ts` (Drizzle DB instance)
    - `schema.ts` (Drizzle schema)
    - `migrations/` (generated)
  - `cache/`
    - `redis.ts` (Upstash Redis client)
    - `keys.ts` (cache key conventions)
  - `ai/`
    - `gateway.ts` (Vercel AI Gateway provider config)
    - `tools/` (web search, etc)

Notes:

- TanStack Start server routes can live inside the same `createFileRoute` file via a `server.handlers` object.
- Alternatively, create route-only “API endpoints” in `src/routes/api/...`.

---

## 4) Authentication (GitHub OAuth)

### Goals

- GitHub OAuth for sign-in.
- Single-user app: only allow access if the GitHub account email matches an env-configured allowlist.

### “Existing GitHub session” expectations

- OAuth sessions are **app-specific**. You cannot directly reuse another app’s session cookie.
- What you *can* rely on:
  - If you’re already signed into GitHub in the browser, the OAuth redirect will typically not require entering credentials.
  - If the same GitHub OAuth App (client id/secret) has already been authorized previously, GitHub often skips/auto-approves the consent step.
- Therefore the UX goal is:
  - First visit: one redirect round-trip, minimal friction.
  - Subsequent visits: your app uses its own session cookie, so it is effectively “auto-login”.

### Flow

- **Client boot**
  - Call `GET /api/auth/session`.
  - If authenticated: continue.
  - If not authenticated: redirect to `GET /api/auth/github`.

- **GitHub OAuth**
  - `GET /api/auth/github` starts the Authorization Code flow.
  - `GET /api/auth/github/callback` exchanges code for access token and fetches GitHub user profile + emails.

- **Allowlist gate (non-negotiable)**
  - Read `AUTH_ALLOWED_EMAILS` (comma-separated) from env.
  - Fetch GitHub emails (requires `user:email` scope).
  - Find a **verified** email (prefer the primary verified email).
  - If no verified email matches allowlist:
    - Reject with `403`.
    - Do not create a session.

### Session storage

- Store the canonical user in Turso.
- Store sessions in Turso for durability (and optionally cache session lookups in Redis).
- Use an `httpOnly` signed cookie to store a session token/id.

Recommended endpoints:

- `GET /api/auth/session` -> returns current user or `401`
- `GET /api/auth/github` -> redirects to GitHub
- `GET /api/auth/github/callback` -> sets session cookie, redirects to app
- `POST /api/auth/logout` -> clears session

Required env vars:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `AUTH_ALLOWED_EMAILS`
- `AUTH_SESSION_SECRET` (cookie signing/encryption secret)
- `APP_ORIGIN` (used to build callback URLs reliably)

---

## 5) Data model (Turso + Drizzle)

This app needs durable storage for:

- Users + sessions (single-user auth)
- Conversations
- Messages
- Projects
- Relationships: conversation <-> project
- User preferences (optional for single-user)
- Stars (can be a boolean on conversation)

### Core tables

- `users`
  - `id`
  - `githubUserId` (text, unique)
  - `email` (text)
  - `name` (text)
  - `avatarUrl` (text)
  - `createdAt`, `updatedAt`

- `sessions`
  - `id`
  - `userId` (fk -> users.id)
  - `expiresAt` (timestamp)
  - `createdAt`
  - `tokenHash` (text; store only a hash of the session token)

- `web_documents` (URL content cache for tools)
  - `id`
  - `url` (original URL)
  - `canonicalUrl` (normalized URL, unique)
  - `title` (best-effort extracted title)
  - `contentText` (cleaned/extracted main text)
  - `contentSha256` (for change detection)
  - `contentType` (text/html, application/pdf, etc)
  - `byteLength` (original payload size)
  - `fetchedAt` (timestamp)
  - `expiresAt` (timestamp; revalidation policy)
  - `etag` (optional)
  - `lastModified` (optional)
  - `fetchStatus` (http status / error code)
  - `source` (optional: which provider surfaced it first)

- `conversations`
  - `id` (uuid / cuid2)
  - `title` (text)
  - `createdAt`, `updatedAt` (timestamp)
  - `lastMessageAt` (timestamp)
  - `starred` (boolean)

- `messages`
  - `id` (uuid / cuid2)
  - `conversationId` (fk -> conversations.id)
  - `role` (`user` | `assistant` | `system` | `tool`)
  - `content` (text)
  - `createdAt` (timestamp)
  - `clientId` (text, optional; for id reconciliation from optimistic UI)
  - `metaJson` (json, optional; attachments/tool calls)

- `projects`
  - `id`
  - `name`
  - `createdAt`, `updatedAt`

- `conversation_projects` (join)
  - `conversationId`
  - `projectId`
  - (unique index on both)

### Indexing

- `messages(conversationId, createdAt)` for pagination
- `conversations(lastMessageAt desc)` for recents
- `conversation_projects(projectId)` and `(conversationId)`

---

## 6) Cache-first architecture (Browser -> Redis -> Turso)

### Cache tiers

- **L0 (Browser)**
  - TanStack Query in-memory cache (fast UI)
  - Persistent storage: IndexedDB recommended (for offline-ish feel and instant loads)

- **L1 (Redis / Upstash)**
  - Shared cache for API responses
  - Ideal for “recent conversations”, conversation metadata, message pages

- **L2 (Turso / libSQL)**
  - Source of truth (durable)

### Read path (query)

1) Query reads from L0 (TanStack Query cache).
2) If L0 is empty, hydrate from IndexedDB (fast local read).
3) If still missing/stale, request server route.
4) Server route checks Redis.
5) On Redis miss, read from Turso and then populate Redis.
6) Server returns response; client stores into IndexedDB and TanStack Query.

### Write path (mutation) with optimistic updates

For every mutation:

- **Step A (client optimistic)**
  - Immediately update TanStack Query cache.
  - Persist the optimistic result in IndexedDB.
  - Use a `clientId` to reconcile server-generated IDs/timestamps.

- **Step B (server commit)**
  - Write to Turso in a transaction.
  - Update/prime Redis keys (write-through).

- **Step C (reconcile)**
  - Server returns canonical object(s).
  - Client replaces optimistic entities by matching `clientId`.

### Redis key conventions (suggested)

- `conv:list:recent` -> array of conversation summaries (small)
- `conv:{id}` -> conversation metadata
- `conv:{id}:msgs:{cursorOrPage}` -> paginated messages
- `project:list` -> projects list
- `project:{id}:convs` -> conversation ids in project

### TTL strategy (suggested)

- Conversation list: 30-120s
- Conversation metadata: 5-30m
- Message pages: 5-30m

Invalidation:

- After message creation, update:
  - `conv:list:recent` and `conv:{id}` (lastMessageAt/title)
  - message page keys for the affected conversation

---

## 7) Server routes (TanStack Start) and API surface

TanStack Start supports adding server endpoints directly in route files via `server.handlers`.

### Recommended endpoints

- `GET /api/auth/session`
- `GET /api/auth/github`
- `GET /api/auth/github/callback`
- `POST /api/auth/logout`

- `GET /api/conversations`
  - Returns recent conversations (cache-first)
- `POST /api/conversations`
  - Creates a new conversation (optimistic client supported)

- `GET /api/conversations/$id`
  - Conversation metadata
- `PATCH /api/conversations/$id`
  - Rename, star/unstar
- `DELETE /api/conversations/$id`
  - Delete conversation (+ cascade messages)

- `GET /api/conversations/$id/messages?cursor=...`
  - Paginated messages
- `POST /api/conversations/$id/messages`
  - Append a user message and stream assistant response

- `GET /api/projects`
- `POST /api/projects`
- `POST /api/projects/$id/add-conversation`

### Streaming response shape

Use a streaming response for assistant output. The client should:

- Create an optimistic `assistant` message with empty content.
- As chunks arrive, append to that message.
- On completion, reconcile with server-provided final message id/timestamps.

---

## 8) AI integration (Vercel AI SDK + AI Gateway)

### Goal

- All LLM calls go through **Vercel AI Gateway**.
- Use the **Vercel AI SDK** for streaming and tool calling.

### Chat UI (AI SDK UI)

- Use **AI SDK UI** for the chat experience. It is framework-agnostic, and for TanStack Start (React) we will use the React hooks:
  - `useChat` for chat interactions + streaming message updates
  - `useCompletion` for simple single-turn completion (optional)
- The chat UI should call a TanStack Start server route that streams the response.

### Environment variables (server-only)

- `AI_GATEWAY_API_KEY` (required)
- `AI_GATEWAY_BASE_URL` (optional; if not default)
- `AI_MODEL` (default model name)

Never expose these to the client.

### Tooling model

The UI will allow selecting tools (ex: web search). Implementation plan:

- Define a tool registry server-side in `src/server/ai/tools/*`.
- Each tool has:
  - `name`
  - `description`
  - `inputSchema`
  - `execute(input) -> output`

The server route decides which tools are available to a request based on:

- UI selection (client passes allowed tool names)
- safety rules

### Tool: web search (multi-provider aggregation)

Goal: grounding via web search with **multiple selectable providers**, and aggregate/merge results.

Supported providers (planned):

- `perplexity`
- `exa`
- `parallel`
- `serp`
- `brave`
- `tavily`

Client behavior:

- Tool selection UI allows selecting 0..N providers.
- Client sends `allowedTools` and tool config (selected providers) with the message request.

Server behavior:

- Implement a single tool `web_search` whose implementation fans out to provider adapters in parallel.
- Normalize results into a common shape:
  - `title`, `url`, `snippet`, `sourceProvider`, `publishedAt?`, `score?`
- Merge + dedupe:
  - Deduplicate by canonicalized URL.
  - Rank by a simple heuristic (provider score if available + recency + diversity), with per-provider timeouts.
- Cache:
  - Redis key: `tool:web_search:{hash(query + providers + options)}`
  - TTL: 5-30 minutes (search results age quickly).
  - Cache negative/partial results briefly to avoid thundering herds.
- Persistence:
  - Store the final aggregated tool payload in `messages.metaJson` for traceability/replay.

#### URL content caching (Turso, read-through)

When the tool needs page contents (for grounding/RAG), it must **avoid re-fetching/scraping** URLs that were previously ingested.

- **Lookup**
  - Canonicalize the URL (strip tracking params, normalize host/path, remove fragments).
  - Check Turso `web_documents` by `canonicalUrl`.
  - If present and `expiresAt > now`: use stored `contentText`.

- **Revalidation** (stale-but-present)
  - If present but expired: attempt conditional fetch using `etag` and/or `lastModified`.
  - If HTTP `304 Not Modified`: bump `fetchedAt/expiresAt` without re-parsing content.
  - If updated: re-extract, update `contentSha256`, `contentText`, and metadata.

- **Fetch and ingest** (miss)
  - Fetch the URL with strict timeouts and a max download size.
  - Extract main content (HTML readability-style extraction; PDF text extraction if supported).
  - Store **only cleaned text** (not raw HTML) unless you explicitly need raw bytes.
  - Write to Turso in a single upsert transaction on `canonicalUrl`.

- **Hot-path caching**
  - Cache `canonicalUrl -> web_documents.id` and `canonicalUrl -> contentSha256` in Redis (short TTL, e.g. 5-30m) to reduce DB round-trips during bursts.

#### Cost and latency optimizations

- **Two-level caching**
  - Cache search results in Redis (already specified) and cache page contents in Turso (`web_documents`).
  - Cache tool outputs in `messages.metaJson` so re-runs within the same conversation can reuse prior results.

- **Request coalescing / single-flight**
  - Use a Redis lock per `tool:web_search:{hash(...)}` and per `webdoc:{canonicalUrl}` so concurrent requests don’t trigger duplicate provider calls or duplicate page fetches.

- **Budgeted fan-out**
  - Cap providers per request (UI allows many, but server enforces max N).
  - Per-provider timeouts and concurrency limits; return partial results quickly.
  - Stop early once you have “enough” high-quality, deduped URLs.

- **Content fetch minimization**
  - Only fetch contents for top K ranked URLs (e.g. 3-8), not every search result.
  - Prefer providers that already return rich snippets/answers; only fetch pages when the model needs grounding citations.
  - Use HEAD/metadata checks before full download when possible.

- **Conditional HTTP and size limits**
  - Use `If-None-Match`/`If-Modified-Since` for revalidation.
  - Enforce max bytes, max text chars, and content-type allowlist.
  - Store extraction errors/status to avoid repeated failing fetches (negative caching).

Provider credentials (server-only env vars; only set the ones you use):

- `PERPLEXITY_API_KEY`
- `EXA_API_KEY`
- `PARALLEL_API_KEY`
- `SERP_API_KEY`
- `BRAVE_API_KEY`
- `TAVILY_API_KEY`

---

## 9) TanStack Query conventions (keys + optimistic patterns)

### Query keys (suggested)

- `['conversations', 'recent']`
- `['conversation', id]`
- `['conversation', id, 'messages', { cursor }]`
- `['projects']`
- `['project', id, 'conversations']`

### Optimistic mutation rules

- Always implement:
  - `onMutate` to apply optimistic cache updates
  - `onError` to rollback
  - `onSuccess` to reconcile canonical server state

Reconciliation is easier if you:

- Generate a `clientId` on the client for each created entity.
- Include that `clientId` in the server request.
- Return the `clientId` with the canonical entity in the response.

---

## 10) UI component policy (shadcn + Base UI)

- Use existing shadcn/base UI primitives in `src/components/ui/*`.
- If you need a new shadcn component (dropdown-menu, dialog, popover, scroll-area, avatar, command, etc):
  - **Add it via the shadcn MCP flow** (do not hand-roll).
  - **Always use the bun command to install components** (e.g. `bunx --bun shadcn@latest add sidebar`)

This will be required for:

- Conversation “three dots” menu
- Rename dialog
- Project picker
- Model/tool selectors

---

## 11) Milestone plan (recommended)

### Milestone 1: Streaming chat MVP (AI only, no DB/cache)

- Server endpoint that streams assistant output (Vercel AI SDK + Vercel AI Gateway)
- Main chat UI:
  - User sends a message
  - Assistant response streams back and renders incrementally (AI SDK UI `useChat`)
- Minimal conversation model (in-memory only):
  - Create a new conversation on first message
  - Show a single conversation entry in the left sidebar
  - Allow selecting it (no rename/star/projects yet)
- No Turso, no Redis, no IndexedDB, no auth

### Milestone 2: UI shell completion (still no persistence)

- Sidebar layout per spec (header, New chat, Chats/Projects nav, footer)
- Main empty state input with actions UI (attach/model/tool selectors as UI-only)
- Chat header after first user message

### Milestone 3: Local-first persistence (browser)

- TanStack Query keys + cache management
- IndexedDB persistence layer
- Optimistic creation of conversations/messages with `clientId` reconciliation

### Milestone 4: Turso persistence (DB, still minimal caching)

- Drizzle schema + migrations for Turso
- Server routes for conversations/messages/projects
- Store conversations/messages durably

### Milestone 5: Authentication (requires DB)

- GitHub OAuth sign-in
- Allowlisted email gate
- Session management + route protection

### Milestone 6: Cache-first + tools

- Redis cache-first reads (browser -> Redis -> Turso)
- Web search tool integration (multi-provider)
- `web_documents` ingestion and reuse for URL content caching
- Add-to-project flows, star/rename/delete polish

---

## 12) Security, privacy, and “personal use” assumptions

- Assume single-user; access is restricted by `AUTH_ALLOWED_EMAILS`.
- Keep API keys on server only.
- Do not store secrets in localStorage.
- Consider encrypting message content at rest only if threat model requires it.

---

## 13) Implementation checklist (quick)

### MVP checklist (Milestone 1)

- [ ] Add Vercel AI SDK dependency and configure AI Gateway usage
- [ ] Add AI SDK UI dependency (React) and implement chat via `useChat`
- [ ] Add a server route that streams completions from the model
- [ ] Build chat UI that renders a streaming assistant message
- [ ] Add minimal left sidebar conversation entry (in-memory)

### Later (Milestones 3+)

- [ ] Implement TanStack Query queries/mutations with optimistic updates
- [ ] Add IndexedDB persistence
- [ ] Add dependencies: Drizzle + libSQL + Upstash Redis
- [ ] Create DB schema + migrations
- [ ] Create Redis cache key helpers
- [ ] Create server routes under `src/routes/api/*`
- [ ] Add GitHub OAuth + allowlisted email gate
- [ ] Add `web_documents` table + URL canonicalization + content extraction pipeline
- [ ] Implement single-flight (Redis locks) for `web_search` and `web_documents` ingestion
