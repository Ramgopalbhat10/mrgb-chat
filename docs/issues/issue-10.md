# Issue 10 — Web Search Sources Fixed Height + Sidebar List Padding Balance

## Type
- bug

## Status
- resolved

## Related Story
- None

## Description
- The web search resources section above the response has no fixed height, causing it to push content down when many sources are returned. It should have a fixed height and be scrollable.
- The left sidebar conversation list highlight has uneven padding — more space on the left side, but the right side is flush against the border. Padding should be equal on both sides, while keeping the scrollbar attached to the right border.

## Root Cause
- Web search sources grid had no max-height or overflow constraint.
- Sidebar left padding accumulated from both `SidebarContent` (`pl-2`) and `SidebarGroup` (`p-2` default), totalling ~1rem on the left, while the right had 0 padding due to `pr-0` override on the group.

## Fix / Approach
- Wrapped the web search sources grid in a container with `max-h-52 overflow-y-auto` to cap height and enable scrolling.
- Removed `pl-2` from `SidebarContent` so groups manage their own padding symmetrically.
- Added `pr-2` to the `SidebarMenu` inside the scrollable `SidebarGroupContent` to give items right padding matching the left, while keeping the scrollbar flush with the sidebar border.

## Files Changed
- `src/features/chat/components/messages/web-search-sources/index.tsx`
- `src/components/app-sidebar.tsx`

## Dev Log

| Date | Unit | Summary |
|---|---|---|
| 2026-05-17 | fix | Added max-h-52 scrollable wrapper to web search sources; balanced sidebar list padding by removing SidebarContent pl-2 and adding pr-2 to conversation SidebarMenu |

## Test Plan
- Visual: web search sources should be capped in height and scrollable when many sources are returned.
- Visual: sidebar conversation list items should have equal padding on left and right; scrollbar should remain flush with the sidebar's right border.
- Verify lint and build pass.

## Definition of Done
- Fix verified (lint + build pass).
- Status set to `resolved`.
- Dev Log updated.
- Progress updated in `docs/PROGRESS.md`.

## References
- Issue 9 — related prior fix for sidebar scrollbar gap
