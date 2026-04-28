# Progress

Current issue: `docs/issues/issue-4.md`

Current section: Issue 4 — Port Label-Driven Agentic Workflow Infrastructure From notes

Previous tasks (latest completed batch only):
- [x] Split `AGENTS.md` into a workflow router plus `docs/PRD.md`.
- [x] Created `.agents/skills/chat-workflow/` with `request-routing`, `tracking-and-docs`, and `execution-gates` references.
- [x] Ported `code-health`, `performance`, and `security` skills and matching Windsurf workflows.
- [x] Added `docs/WORKFLOW.md`, `docs/WORKFLOW_LABELS.md`, and story/issue/learning/decision scaffolding.
- [x] Migrated the three prior `docs/ISSUES.md` entries into `docs/issues/issue-1.md`, `issue-2.md`, and `issue-3.md`, and deleted `docs/ISSUES.md`.
- [x] Archived the historical goal-by-goal log to `docs/PROGRESS_ARCHIVE.md` and rewrote `docs/PROGRESS.md` using the structured format.
- [x] Added `.github/PULL_REQUEST_TEMPLATE.md`, `scripts/workflow/*.mjs`, executable `.githooks/`, `workflow:*` scripts in `package.json`, and a `Development Workflow` section in `README.md`.

Next tasks:
- None - all tasks completed.

Notes:
- Branch: `chore/workflow-infrastructure-port`.
- Enable the enforced hooks with `git config core.hooksPath .githooks` after checkout.
