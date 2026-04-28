# Issue 2 — Scroll-to-bottom Indicator Stuck After Regeneration

## Type
- bug

## Status
- resolved

## Related Story
- None

## Description
- When a chat had only two messages (a user input and an assistant response) and the response was regenerated, the scroll-to-bottom indicator remained visible at the top of the message list even though there was no overflow to scroll.

## Root Cause
- The scroll-to-bottom indicator did not recalculate its visibility on content changes and did not hide when the virtualized list had no overflow, leaving a stale indicator after regeneration.

## Fix / Approach
- Recalculate the indicator's visibility on content changes and explicitly hide it when the content does not overflow the viewport.

## Files Changed
- `src/features/chat/components/chat/chat-messages-virtual.tsx`

## Dev Log

| Date | Unit | Summary |
|---|---|---|
| 2026-04 | fix | Recalculated scroll-to-bottom indicator on content changes and hid it when there is no overflow. |

## Test Plan
- Regenerate the only assistant response in a two-message chat and confirm the indicator is hidden.
- Grow the chat until it overflows and confirm the indicator reappears.

## Definition of Done
- Fix verified (lint + build pass).
- Status set to `resolved`.
- Dev Log updated.
- Progress updated in `docs/PROGRESS.md`.

## References
- `docs/PROGRESS_ARCHIVE.md` (Goal 03)
