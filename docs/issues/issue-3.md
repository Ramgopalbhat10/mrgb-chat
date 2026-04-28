# Issue 3 — Scroll Position Lost After Streaming Completes

## Type
- bug

## Status
- resolved

## Related Story
- None

## Description
- While the assistant response was streaming and the user scrolled to a specific position inside the response, the scroll position was lost once the response completed — the list would snap back to the top of the current response.
- The desired behavior is to preserve the reader's scroll position when the stream completes.

## Root Cause
- Auto-scroll was unconditionally re-anchoring to the bottom (or snapping on size changes) when the stream completed, overriding the user's manual scroll position mid-response.

## Fix / Approach
- Lock auto-scroll only when the user stays at the bottom.
- Disable size-change adjustments when the user has scrolled away so streaming/regeneration completion does not drift the view.
- Preserve the reader's position when streaming completes.

## Files Changed
- `src/features/chat/components/chat/chat-messages-virtual.tsx`

## Dev Log

| Date | Unit | Summary |
|---|---|---|
| 2026-04 | fix | Locked auto-scroll to bottom only when user is at bottom; preserved scroll position on stream completion. |

## Test Plan
- During a long streaming response, scroll up to an earlier point and confirm the position is retained after the stream completes.
- While at the bottom, confirm new content keeps auto-scrolling.

## Definition of Done
- Fix verified (lint + build pass).
- Status set to `resolved`.
- Dev Log updated.
- Progress updated in `docs/PROGRESS.md`.

## References
- `docs/PROGRESS_ARCHIVE.md` (Goal 03)
