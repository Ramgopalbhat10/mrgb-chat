# AGENTS.md (Repo Guide)

This repo is a TanStack Start ChatGPT-like app (Bun, Turso, Redis, Vercel AI SDK).

## Workflow Labels
On every request, scan for a `[label]` prefix first — before loading any files or taking any action.
- `[ask]` — Conversational only. Answer directly. Do NOT load `PROGRESS.md`, `WORKFLOW.md`, or any workflow files.
- `[code-only]` — Code implementation only. Skip docs, branch, quality, commit, PR.
- `[docs-only]` — Create/update story or issue documentation only.
- `[quality]` — Run lint, build only.
- `[commit]` — Gap-fill phases 2, 3, 5, 6 if incomplete, then commit.
- `[push]` — Gap-fill ALL incomplete phases, then create PR.
- **No label, conversational intent** (e.g. a question with no code/doc changes) — treat as `[ask]`.
- **No label, implementation intent** — execute all 9 phases in the repo workflow via `.agents/skills/chat-workflow/SKILL.md`.

## Constraints (Always Enforced)
- NEVER commit to `main`. Branch: `feature/`, `fix/`, `refactor/`, `chore/`, `docs/`.
- NEVER create PR if any required phase is incomplete — list missing phases instead.

## Package Manager
- Use `bun` (not `npm` or `pnpm`).

## Workflow
- Primary agent workflow source: `.agents/skills/chat-workflow/SKILL.md`
- Human backup summary: `docs/WORKFLOW.md`
- Human label reference: `docs/WORKFLOW_LABELS.md`
- Current focus: `docs/PROGRESS.md`
- Gotchas and lessons: `docs/learnings/README.md`

## Session Bootstrap (New Chat)
- **Step 1:** Scan the request for a `[label]` prefix or conversational intent before loading anything.
  - `[ask]` or conversational → answer directly. Stop here; load nothing else.
  - All other labels or implementation intent → continue to Step 2.
- **Step 2:** Load `.agents/skills/chat-workflow/SKILL.md` and use its references as the workflow source of truth.
- **Step 3:** Load `docs/PROGRESS.md` and the current story/issue, then use stories, issues, learnings, decisions, and PRD docs only as supporting repo context.
- Load `docs/WORKFLOW.md` and `docs/WORKFLOW_LABELS.md` only as backup human references when you need to confirm the mirrored wording.

## Testing Policy
- The project has a test suite. Run `bun run test` when it applies to the change.
- Follow existing testing conventions in the repo. Do not add a new test framework without discussion.

## Quick Commands
- Install: `bun install`
- Dev: `bun run dev`
- Lint: `bun run lint`
- Build: `bun run build`
- Format: `bun run format`
- Test: `bun run test`

## Agent Skills
- Skills live in `.agents/skills/<name>/SKILL.md` following the [Agent Skills spec](https://agentskills.io/specification).
- Windsurf users: invoke via `/slash-command`. Other agents: read the SKILL.md directly.
- `/chat-workflow` — repo routing, issue/story tracking, progress updates, quality gates, commits, and PR readiness.
- `/code-health` — duplication, dead code, naming, deprecated usage, complexity.
- `/security` — weak validation, secret exposure, injection risks, auth bypass.
- `/performance` — slow queries, re-renders, bundle bloat, inefficient algorithms.

## Context Pointers
- Setup, env, scripts: `README.md`
- Product/architecture: `docs/PRD.md`
- Work history/stories: `docs/stories/README.md`
- Bugs, refactors, and non-feature work: `docs/issues/README.md`
- Architectural decisions: `docs/decisions/README.md`
