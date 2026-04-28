# Issue 1 — Duplicate User Message on First Send

## Type
- bug

## Status
- resolved

## Related Story
- None

## Description
- When a new chat was selected and a first message was sent, the UI displayed the user message twice.
- Once response streaming completed, the UI removed the duplicate user message.

## Root Cause
- User message IDs were not generated upfront before being passed to `useChat`, so the optimistic send and the streaming update produced two entries for the same user message until the stream settled.

## Fix / Approach
- Generate the user message ID up front and pass it into `useChat` for send and pending flows so the optimistic entry and the server-confirmed entry reconcile to a single row during the first send.

## Files Changed
- `src/features/chat/components/chat/chat-view.tsx`

## Dev Log

| Date | Unit | Summary |
|---|---|---|
| 2026-04 | fix | Generated user message IDs upfront for first-send flows to remove duplicated user rows during streaming. |

## Test Plan
- Start a new chat, send the first message, and confirm only one user row is rendered while the assistant response streams.
- Send a second message in the same chat and confirm no duplication.

## Definition of Done
- Fix verified (lint + build pass).
- Status set to `resolved`.
- Dev Log updated.
- Progress updated in `docs/PROGRESS.md`.

## References
- `docs/PROGRESS_ARCHIVE.md` (Goal 03)
