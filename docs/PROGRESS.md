# Progress

Current issue: `docs/issues/issue-5.md`

Current section: Issue 5 — Add `AUTH_BYPASS=true` Single-Flag Local Auth Bypass

Previous tasks (latest completed batch only):
- [x] Closed Issue 6 (ESLint baseline cleanup) on `chore/eslint-baseline-cleanup`.
- [x] Added `src/lib/auth-bypass-config.ts` exporting `AUTH_BYPASS_ENABLED` and `createAuthBypassSession()`.
- [x] Made `src/lib/auth.ts` conditionally construct `betterAuth(...)` when bypass is off.
- [x] Short-circuited `getSession`/`requireAuth` in `src/server/auth/get-session.ts` when bypass is on.
- [x] Intercepted `/api/auth/*` GET/POST in `src/routes/api/auth/$.ts`.
- [x] Added a `beforeLoad` redirect on `src/routes/login.tsx` so `/login` jumps to `/` when bypass is on.
- [x] Documented `AUTH_BYPASS` in `README.md`.
- [x] `bun run lint` (0 errors), `bun run build` pass; verified end-to-end with `AUTH_BYPASS=true bun run dev` (synthetic session returned, `/api/llm-settings` returns 200, `/login` 307s to `/`, UI shell renders as `Local Dev`).

Next tasks:
- None - all tasks completed.

Notes:
- Branch: `chore/auth-bypass`, rebased onto `chore/eslint-baseline-cleanup` so the autofixed import order survives.
- Mirrors the notes pattern (`lib/auth/config.ts`, `lib/auth/index.ts`, `proxy.ts`, `app/api/auth/[...betterauth]/route.ts`).
