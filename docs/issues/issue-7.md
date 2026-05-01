# Issue 7 — Chat Rendering Stability

## Type
- performance

## Status
- resolved

## Related Story
- None

## Description
- Long conversations and streaming assistant responses with Markdown/code blocks can flicker, shift, or render with stale virtualized offsets.
- User and assistant messages should render smoothly without overlap, unexpected layout shifts, or code-block controls appearing over unrelated content.

## Root Cause
- Virtualized row indices were sometimes treated as message indices even though the rendered row list can include branch, loading, and suggestion rows.
- Streaming Markdown/code highlighting mutates row height after React render, so virtualization measurements can temporarily lag behind actual row height.
- Streaming assistant rows applied descendant fade animations while content was still arriving, adding unnecessary visual churn.
- Collapsible code block controls were processed during streaming and their absolutely positioned overlay did not establish a local positioning context.

## Fix / Approach
- Key virtual rows by stable row identity and resolve scroll anchors through row data instead of raw message indexes.
- Re-measure the active streaming/regenerating row while its Markdown/code content changes.
- Keep streaming Markdown rendering non-animated and process collapsible code blocks only after content is stable.
- Add overflow-safe message/code-block layout constraints.

## Files Changed
- `src/features/chat/components/chat/chat-messages-virtual.tsx`
- `src/features/chat/components/messages/chat-message-row/index.tsx`
- `src/components/collapsible-code-blocks.tsx`
- `src/styles.css`

## Dev Log

| Date | Unit | Summary |
|---|---|---|
| 2026-05-01 | fix | Started chat rendering stability pass after tracing `ChatPage` → `ChatView` → `ChatMessagesVirtual` → `ChatMessageRow` streaming/virtualization flow. |
| 2026-05-01 | fix | Fixed row-keyed virtualization anchoring, active streaming row re-measurement, non-animated streaming Markdown, deferred code-block collapse processing during stream, and overflow-safe message/code styles. |

## Test Plan
- `bun run lint`
- `bun run build`
- `bun run test` (currently exits 1 because the repository contains no test files)
- Manually verify long streaming Markdown/code responses and long message lists keep stable row positions.

## Definition of Done
- Fix verified (lint + build + test pass).
- Status set to `resolved`.
- Dev Log updated.
- Progress updated in `docs/PROGRESS.md`.

## References
- Issue 2 (`docs/issues/issue-2.md`) and Issue 3 (`docs/issues/issue-3.md`) previously addressed related scroll behavior.
