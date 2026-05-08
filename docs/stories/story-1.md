# Story 1 — Web Search Integration with Parallel Provider

Goal: Let users toggle a web-search provider (Parallel) from the chat input so that the assistant can ground answers in fresh web results when the toggle is on.

## Scope
- In:
  - Add `@parallel-web/ai-sdk-tools` and wire its `searchTool` into the `/api/chat` route, gated by a `searchEnabled` request flag, with multi-step tool calling (`stopWhen: stepCountIs(5)`).
  - New `SearchProviderPicker` component rendered as a Base UI Popover from the chat input. Lists providers; only **Parallel** is interactive in this story.
  - Web-search toggle state held in `chat-view.tsx`, threaded through `chat-input.tsx`, included in the chat transport body via a ref so the latest value is sent on each message.
  - Minimal "Searched the web · N sources" badge above assistant messages whose parts include `tool-web_search` invocations.
- Out:
  - Persisting tool-call parts to IndexedDB / `metaJson` (badge will not survive reload).
  - Rich result cards (titles, excerpts, favicons).
  - Additional providers (Tavily, Exa, etc.) — listed as disabled "Coming soon" only if added later; this story keeps the picker single-provider.
  - Per-conversation default for the toggle; state is ephemeral per session.
  - Tracking Parallel usage cost in message metadata.

## Deliverables
- New: `src/features/chat/components/chat/search-provider-picker.tsx`.
- Updated: `src/routes/api/chat.ts`, `src/features/chat/components/chat/chat-input.tsx`, `src/features/chat/components/chat/chat-view.tsx`, `src/features/chat/components/messages/utils/chat-message-utils.ts`, `src/features/chat/components/messages/chat-message-row/index.tsx`.
- Dependency: `@parallel-web/ai-sdk-tools` added via `bun add`.
- Docs: this story file, `docs/stories/README.md` index row, `docs/PROGRESS.md` reset.

## Acceptance Criteria
- Clicking the chat-input Search button opens a popover that lists Parallel as an interactive provider; toggle reflects on/off state and persists across opens within the same session.
- Sending a message with the toggle ON includes `searchEnabled: true` in the `/api/chat` POST body; the server registers `tools: { web_search: searchTool }` and runs with `stopWhen: stepCountIs(5)`.
- Sending a message with the toggle OFF behaves exactly like before this story (no tools registered, no `stopWhen`).
- For an assistant message whose `parts` include a `tool-web_search` invocation, a globe-icon badge "Searched the web · N sources" renders above the answer body.
- Server returns 500 with a clear message if `searchEnabled: true` is requested while `PARALLEL_API_KEY` is missing.

## Dev Log

| Date | Unit | Summary |
|---|---|---|
| 2026-05-08 | docs | Created story doc, story-index entry, and reset PROGRESS for the Parallel web-search integration. |
| 2026-05-08 | feat | Added `@parallel-web/ai-sdk-tools@0.2.1`; wired `searchTool` into `/api/chat` behind a `searchEnabled` body flag with `stopWhen: stepCountIs(5)` and a `PARALLEL_API_KEY` 500 guard. |
| 2026-05-08 | feat | Built `SearchProviderPicker` Base UI Popover (Parallel-only for now) and replaced the placeholder Search button in `chat-input.tsx`; threaded `webSearchEnabled` state + ref through `chat-view.tsx` so the latest toggle value flows into each chat-transport request. |
| 2026-05-08 | feat | Added `getWebSearchParts` / `countWebSearchSources` utilities and a "Searched the web · N sources" badge above assistant messages whose parts include `tool-web_search`, with a streaming "Searching the web" state. |
| 2026-05-08 | quality | `bun run lint` clean (0 errors, baseline 77 warnings); `bun run build` clean; `bun run test` exits 1 — no test files (pre-existing baseline, see issue-7). |

## Issues
<!-- Cross-references to related issues (bugs, refactors, perf fixes) filed against this story. -->

| Issue | Title | Status | File |
|---|---|---|---|
| 8 | Web Search Toggle Infinite Loop + New-Chat Empty View | resolved | `docs/issues/issue-8.md` |

---

## Story 1.1 — Foundation: Parallel SDK + server tool wiring
- Components
  - `package.json`, `bun.lock`
  - `src/routes/api/chat.ts`
- Behavior
  - Install `@parallel-web/ai-sdk-tools`.
  - Read `searchEnabled: boolean` from the request body. When `true`, register `tools: { web_search: searchTool }` on `streamText` and set `stopWhen: stepCountIs(5)`. When `false`, no tools and no `stopWhen` (preserve current behavior).
  - 500 guard if `searchEnabled` is true but `PARALLEL_API_KEY` is missing — mirror the existing `AI_GATEWAY_API_KEY` guard.

Sub-tasks
- [x] `bun add @parallel-web/ai-sdk-tools`; verify resolved version with `bun pm ls @parallel-web/ai-sdk-tools`.
- [x] Update `/api/chat` POST handler to read `searchEnabled`, conditionally pass `tools` + `stopWhen`, and add the `PARALLEL_API_KEY` guard.

Test Plan
- `bun run lint` clean.
- `bun run build` clean.
- Manual: temporarily POST `searchEnabled: true` with a current-events question; observe `tool-web_search` parts in the streamed response.

---

## Story 1.2 — UI: provider picker + state plumbing
- Components
  - `src/features/chat/components/chat/search-provider-picker.tsx` (new)
  - `src/features/chat/components/chat/chat-input.tsx`
  - `src/features/chat/components/chat/chat-view.tsx`
- Behavior
  - New `SearchProviderPicker` opens a Base UI Popover (using `src/components/ui/popover.tsx`) anchored on a button styled like the existing placeholder Search button. Lists providers with a per-row toggle; only Parallel is interactive.
  - `chat-view.tsx` holds `webSearchEnabled` state plus `webSearchEnabledRef` synced via effect. The `DefaultChatTransport` body callback adds `searchEnabled: webSearchEnabledRef.current`.
  - `chat-input.tsx` receives `webSearchEnabled` and `onSearchToggle` props, renders the picker in place of the placeholder Search button.

Sub-tasks
- [x] Create `SearchProviderPicker`.
- [x] Add state + ref + transport-body update in `chat-view.tsx`; pass props to `<ChatInput>`.
- [x] Replace placeholder Search button in `chat-input.tsx` with the picker; wire props.

Test Plan
- Click trigger → popover opens; toggle row → state flips; close/reopen → state preserved.
- Send a message with toggle ON → DevTools network shows `searchEnabled: true` in payload; with toggle OFF → no `searchEnabled` flag (or `false`).

---

## Story 1.3 — Rendering + verification
- Components
  - `src/features/chat/components/messages/utils/chat-message-utils.ts`
  - `src/features/chat/components/messages/chat-message-row/index.tsx`
- Behavior
  - Add `getWebSearchParts()` filter for `part.type === 'tool-web_search'`.
  - Render a small "Searched the web · N sources" badge above the assistant message body when web-search parts exist; N = unique URLs across all tool results.

Sub-tasks
- [x] Add `getWebSearchParts` to `chat-message-utils.ts`.
- [x] Render the badge in `chat-message-row/index.tsx`.
- [x] Run `bun run lint`, `bun run build`, `bun run test`.
- [ ] Manual smoke (toggle ON and OFF) per the verification flow in the plan — pending user verification in browser.

Test Plan
- With toggle ON, a current-events prompt produces a synthesised answer with the badge; with toggle OFF, no badge and no `searchEnabled` flag in the payload.
- `bun run lint && bun run build` clean.

---

## Definition of Done
- Acceptance criteria met.
- Dev Log updated for each unit of work.
- Progress updated in `docs/PROGRESS.md`.
- Quality gates pass (lint + build + test where applicable).

## References
- Plan: `C:\Users\ramgo\.claude\plans\purrfect-sprouting-pie.md`
- Parallel + Vercel AI SDK docs: https://docs.parallel.ai/integrations/vercel
- AI SDK web-search agent cookbook: https://ai-sdk.dev/cookbook/node/web-search-agent#parallel-web
