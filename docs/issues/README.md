# Issue Index

Track bug fixes, refactors, performance fixes, code cleanup, and other non-feature work.

Issue template: `docs/issues/template.md`

| Issue | Title | Status | Related Story | File |
|---|---|---|---|---|
| 1 | Duplicate User Message on First Send | resolved | None | `src/features/chat/components/chat/chat-view.tsx` |
| 2 | Scroll-to-bottom Indicator Stuck After Regeneration | resolved | None | `src/features/chat/components/chat/chat-messages-virtual.tsx` |
| 3 | Scroll Position Lost After Streaming Completes | resolved | None | `src/features/chat/components/chat/chat-messages-virtual.tsx` |
| 4 | Port Label-Driven Agentic Workflow Infrastructure From notes | resolved | None | `AGENTS.md`, `docs/*`, `.agents/*`, `.windsurf/*`, `.githooks/*`, `scripts/workflow/*`, `package.json`, `README.md` |
| 5 | Add `AUTH_BYPASS=true` Single-Flag Local Auth Bypass | resolved | None | `src/lib/auth-bypass-config.ts`, `src/lib/auth.ts`, `src/server/auth/get-session.ts`, `src/routes/api/auth/$.ts`, `src/routes/login.tsx`, `README.md` |
| 6 | Establish ESLint Baseline (autofix + targeted rule overrides) | resolved | None | `eslint.config.js`, `src/**` (autofix sweep) |
| 7 | Chat Rendering Stability | resolved | None | `src/features/chat/components/chat/chat-messages-virtual.tsx`, `src/features/chat/components/messages/chat-message-row/index.tsx`, `src/components/collapsible-code-blocks.tsx`, `src/styles.css` |
| 8 | Web Search Toggle Infinite Loop + New-Chat Empty View | resolved | Story 1 | `src/features/chat/components/chat/chat-view.tsx`, `src/routes/chat.$id.tsx` |
