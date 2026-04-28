## Type
- chore

## Status
- resolved

## Related Story
- None

## Description
- Local development requires real GitHub OAuth credentials (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) for the app to even boot, because `src/lib/auth.ts` always instantiates `betterAuth({...})`. There is no way to skip authentication while iterating on UI/data flows offline.
- Mirror the single-flag bypass pattern used in `Ramgopalbhat10/notes` (`lib/auth/config.ts`, `lib/auth/index.ts`, `proxy.ts`, `app/api/auth/[...betterauth]/route.ts`) so that setting `AUTH_BYPASS=true` short-circuits the entire auth stack with a synthetic local session.

## Root Cause
- `src/lib/auth.ts` calls `betterAuth(...)` at module load with the GitHub provider, so missing OAuth env vars throw at import time and crash any route that touches auth.
- `src/server/auth/get-session.ts` and `src/routes/api/auth/$.ts` always defer to the real BetterAuth instance, with no escape hatch for local-only flows.

## Fix / Approach
- Add `src/lib/auth-bypass-config.ts` exporting `AUTH_BYPASS_ENABLED` and `createAuthBypassSession()` (synthetic session shaped to match the BetterAuth/Drizzle schema in `src/server/db/schema.ts`).
- Make `src/lib/auth.ts` lazy: when bypass is on, export `auth = null` instead of constructing the BetterAuth instance, so missing GitHub credentials no longer crash boot.
- Short-circuit `getSession`/`requireAuth` in `src/server/auth/get-session.ts` to return the synthetic session when bypass is on.
- Intercept GET/POST in `src/routes/api/auth/$.ts`: return the synthetic session on `/get-session`, `{ success: true }` on `/sign-out`, and redirect everything else to `/`. Only call `auth.handler(request)` when bypass is off and `auth` is non-null.
- Add a server-function `beforeLoad` on `src/routes/login.tsx` that redirects to `/` when bypass is on, so the login page never flashes.
- Document `AUTH_BYPASS=true` in the README under local setup so it's discoverable.

## Files Changed
- `src/lib/auth-bypass-config.ts` (new)
- `src/lib/auth.ts`
- `src/server/auth/get-session.ts`
- `src/routes/api/auth/$.ts`
- `src/routes/login.tsx`
- `README.md`
- `docs/issues/issue-5.md` (this file)
- `docs/issues/README.md`
- `docs/PROGRESS.md`

## Dev Log

| Date | Unit | Summary |
|---|---|---|
| 2026-04-28 | chore | Added `AUTH_BYPASS=true` single-flag bypass mirroring the notes repo pattern: synthetic session config module, conditional `betterAuth` construction, short-circuited `getSession`/`requireAuth`, intercepted `/api/auth/*` handler, and a server-side `beforeLoad` redirect on `/login`. |

## Test Plan
- With `AUTH_BYPASS=true` and no `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`:
  - `bun run dev` starts without throwing.
  - `GET /api/auth/get-session` returns the synthetic session JSON.
  - `POST /api/auth/sign-out` returns `{ success: true }`.
  - Authenticated API routes (e.g. `/api/conversations`, `/api/llm-settings`) return 200, not 401.
  - The UI renders without redirecting to `/login`; visiting `/login` redirects to `/`.
- With `AUTH_BYPASS` unset: `auth.handler` is wired up exactly as before, the GitHub OAuth flow still works.

## Definition of Done
- Fix verified (`bun run lint` + `bun run build` pass).
- Status set to `resolved`.
- Dev Log updated.
- Progress updated in `docs/PROGRESS.md`.

## References
- `Ramgopalbhat10/notes` reference files: `lib/auth/config.ts`, `lib/auth/index.ts`, `proxy.ts`, `app/api/auth/[...betterauth]/route.ts`.
