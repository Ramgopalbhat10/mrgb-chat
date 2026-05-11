# Issue 9 — Sidebar Scrollbar Gap From Right Border

## Type
- bug

## Status
- resolved

## Related Story
- None

## Description
- The scrollbar in the left sidebar conversation list has a visible gap between it and the sidebar's right border. The scrollbar should sit flush against the right edge.

## Root Cause
- Cumulative right padding from two parent containers (`SidebarContent` with `px-2` and `SidebarGroup` base `p-2`) pushes the scroll container 16px inward from the sidebar border, placing the scrollbar away from the edge.

## Fix / Approach
- Remove right padding from `SidebarContent` (`px-2` → `pl-2`).
- Override right padding on the scrollable `SidebarGroup` (`pr-0`).
- Restore right padding on the search input container so it doesn't touch the sidebar border.

## Files Changed
- `src/components/app-sidebar.tsx`

## Dev Log

| Date | Unit | Summary |
|---|---|---|
| 2026-05-11 | fix | Removed right padding from SidebarContent and scrollable SidebarGroup; added pr-2 to search container |

## Test Plan
- Visual: scrollbar in sidebar conversation list should be flush against the sidebar's right border.
- Verify lint and build pass.

## Definition of Done
- Fix verified (lint + build pass).
- Status set to `resolved`.
- Dev Log updated.
- Progress updated in `docs/PROGRESS.md`.

## References
- `src/components/ui/sidebar.tsx` — SidebarContent, SidebarGroup base components
