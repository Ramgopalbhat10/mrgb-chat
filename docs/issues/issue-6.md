## Type
- chore

## Status
- resolved

## Related Story
- None

## Description
- The TanStack ESLint preset adopted in Issue 4 reported ~350 errors against existing code (auto-formatting, import order, `@typescript-eslint/no-unnecessary-condition`, etc.). The `pre-push` hook runs `bun run lint`, so any new branch gets blocked on this baseline noise instead of on real regressions.
- Establish a clean lint baseline so future PRs only have to worry about errors they introduce.

## Root Cause
- The `@tanstack/eslint-config` preset's defaults are stricter than what the existing codebase was authored against.
- Two non-source files (`eslint.config.js`, `prettier.config.js`) and the auto-generated `src/routeTree.gen.ts` are not part of the TS project, so `@typescript-eslint/parser` errors out parsing them.
- One stale `// eslint-disable-next-line react-hooks/exhaustive-deps` comment referenced a rule that isn't loaded in this project, raising a "rule not found" error.

## Fix / Approach
- Run `eslint --fix` once to apply every safe autofix (imports order, type-only imports, `Array<T>` style, sort-imports, etc.).
- Update `eslint.config.js` to:
  - Ignore `eslint.config.js`, `prettier.config.js`, `src/routeTree.gen.ts`, and build outputs (`.vercel/**`, `.output/**`, `.nitro/**`, `dist/**`, `drizzle/**`).
  - Demote `@typescript-eslint/no-unnecessary-condition` from `error` to `warn`. The rule has a high false-positive rate against defensive null/undefined guards on values whose runtime shape is looser than their declared TS type (e.g. AI SDK message parts, query data after manual cache writes). Demoting keeps editor visibility without blocking CI.
- Remove the stale `react-hooks/exhaustive-deps` disable comment from `chat-messages-virtual.tsx`.

After this change `bun run lint` reports `0 errors, 77 warnings` and exits 0.

## Files Changed
- `eslint.config.js`
- `src/features/chat/components/chat/chat-messages-virtual.tsx` (stale eslint-disable comment)
- 60+ other files touched by `eslint --fix` (import order, type-only imports, `Array<T>` style, etc.)

## Dev Log

| Date | Unit | Summary |
|---|---|---|
| 2026-04-28 | chore | Established lint baseline: ran `eslint --fix` across the repo, scoped tsx/ts-only ignore for non-project config files and generated routes, demoted `no-unnecessary-condition` to warn, removed a stale `react-hooks/exhaustive-deps` disable comment. `bun run lint` now exits 0 with 77 warnings only. |

## Test Plan
- `bun run lint` exits 0 (warnings only).
- `bun run build` succeeds.

## Definition of Done
- Lint baseline is clean (0 errors).
- Status set to `resolved`.
- Dev Log updated.
- Progress updated in `docs/PROGRESS.md`.

## References
- Issue 4 (`docs/issues/issue-4.md`) introduced the strict TanStack preset.
- Unblocks Issue 5's push (`chore/auth-bypass`).
