# Issue 4 — Port Label-Driven Agentic Workflow Infrastructure From notes

## Type
- chore

## Status
- resolved

## Related Story
- None

## Description
- The chat app previously had only a flat `AGENTS.md` monolith and a free-form `docs/PROGRESS.md`.
- Port the label-driven workflow system from `Ramgopalbhat10/notes` so agents, humans, and git hooks all follow the same strict routing, documentation, quality, commit, and PR gates.
- Adapt the imported structure to the chat app's stack: `bun` as the package manager, and a testing policy that keeps `bun run test` instead of forbidding test files.

## Root Cause
- The workflow enforcement that exists in `notes` is a prerequisite for predictable agentic development. Without it, each request had to re-derive branch/commit/docs rules every session.

## Fix / Approach
- Split `AGENTS.md` into a workflow router plus a dedicated `docs/PRD.md` for product/architecture context.
- Create the `.agents/skills/chat-workflow/` skill (plus `code-health`, `performance`, `security`) and matching `.windsurf/workflows/` entries.
- Create `docs/WORKFLOW.md`, `docs/WORKFLOW_LABELS.md`, `docs/stories/`, `docs/issues/`, `docs/learnings/`, `docs/decisions/` scaffolding.
- Migrate the three historical entries from `docs/ISSUES.md` into `docs/issues/issue-1.md`, `issue-2.md`, and `issue-3.md`; delete the legacy `docs/ISSUES.md`.
- Archive the historical goal-by-goal log to `docs/PROGRESS_ARCHIVE.md` and rewrite `docs/PROGRESS.md` using the structured format.
- Add `.github/PULL_REQUEST_TEMPLATE.md`, `scripts/workflow/check-workflow-docs.mjs`, `scripts/workflow/check-commit-message.mjs`, and executable `.githooks/` (pre-commit, commit-msg, pre-push).
- Add `workflow:*` scripts to `package.json` and document `git config core.hooksPath .githooks` in `README.md`.

## Files Changed
- `AGENTS.md`
- `docs/PRD.md`
- `docs/PROGRESS.md`
- `docs/PROGRESS_ARCHIVE.md`
- `docs/WORKFLOW.md`
- `docs/WORKFLOW_LABELS.md`
- `docs/stories/README.md`
- `docs/stories/template.md`
- `docs/issues/README.md`
- `docs/issues/template.md`
- `docs/issues/issue-1.md`
- `docs/issues/issue-2.md`
- `docs/issues/issue-3.md`
- `docs/issues/issue-4.md`
- `docs/learnings/README.md`
- `docs/decisions/README.md`
- `.agents/skills/chat-workflow/SKILL.md`
- `.agents/skills/chat-workflow/references/request-routing.md`
- `.agents/skills/chat-workflow/references/tracking-and-docs.md`
- `.agents/skills/chat-workflow/references/execution-gates.md`
- `.agents/skills/chat-workflow/agents/openai.yaml`
- `.agents/skills/code-health/SKILL.md`
- `.agents/skills/performance/SKILL.md`
- `.agents/skills/security/SKILL.md`
- `.windsurf/workflows/code-health.md`
- `.windsurf/workflows/performance.md`
- `.windsurf/workflows/security.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `scripts/workflow/check-workflow-docs.mjs`
- `scripts/workflow/check-commit-message.mjs`
- `.githooks/pre-commit`
- `.githooks/commit-msg`
- `.githooks/pre-push`
- `package.json`
- `README.md`
- `docs/ISSUES.md` (deleted)

## Dev Log

| Date | Unit | Summary |
|---|---|---|
| 2026-04-28 | chore | Ported the label-driven workflow infrastructure from `notes` to `mrgb-chat`, adapted for Bun and the existing test suite. |

## Test Plan
- Inspect the new scaffolding for structural correctness.
- Run `bun run lint` and `bun run build` to ensure no existing surface regressed.
- Run `bun run workflow:check-docs:staged` against the staged changes to verify the checker accepts this bootstrap state.
- Run `bun run workflow:check-commit-msg` with a dummy Conventional Commit message to verify the checker passes.
- Enable git hooks with `git config core.hooksPath .githooks` and confirm `pre-commit`, `commit-msg`, and `pre-push` execute the respective scripts.

## Definition of Done
- All files listed above exist, are consistent, and reference each other correctly.
- `bun run lint` and `bun run build` pass.
- `bun run workflow:check-docs:staged` accepts the current branch state.
- PR created against `main` using `.github/PULL_REQUEST_TEMPLATE.md`.

## References
- `Ramgopalbhat10/notes` label-driven workflow (source of truth).
- `docs/PROGRESS_ARCHIVE.md` (prior free-form progress log).
