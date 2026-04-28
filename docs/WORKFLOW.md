# Workflow Standards

This file is a human-facing backup summary. Agents should follow `.agents/skills/chat-workflow/SKILL.md` first. Repo enforcement lives in `scripts/workflow/` and `.githooks/`.

## 1) Mode
- Planning: propose branch, story/issue, and approach only. No repo mutations.
- Execution: follow the repo workflow or the label-specific override.
- No-op: if the request has no code/docs impact, do nothing.

## 2) Route And Document
- Treat each new request independently.
- Classify the work as a Story for user-facing capability changes or an Issue for bugs, refactors, performance, cleanup, workflow, or tooling work.
- Reuse matching active story/issue docs and branches when the scope is the same.
- For new work, create the correct story/issue file from the template, update the matching index, create the correctly prefixed branch from updated `main`, and reset `docs/PROGRESS.md`.

## 3) Pre-Code Gate
- Read `docs/PROGRESS.md` and the current story/issue.
- Review learnings first; review decisions when architecture/data-flow/auth/caching/AI routing changes are involved.
- Confirm branch status and prefix with `git status --short --branch`.
- Verify the story/issue exists in its index and `docs/PROGRESS.md` has the required structure.

## 4) Execute One Unit Of Work
- Keep scope tight to one legitimate unit aligned with the current `docs/PROGRESS.md` section.

## 5) Post-Code Gate
- Update sub-tasks, add one Dev Log row, and move only the just-finished tasks from `Next tasks` to `Previous tasks`.
- Keep cross-references, indexes, decisions, and learnings current when applicable.

## 6) Quality Gate
- Run `bun run lint` when code changed.
- Run `bun run build` for user-visible or risky changes.
- Run `bun run test` when the change affects tested behavior.
- Optional: run `bun run format` before committing when style drift is likely.

## 7) Commit Rule
- Commit only on a non-`main` branch.
- Use Conventional Commits with allowed prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.

## 8) Pre-PR Verification
- Verify branch, docs, index, progress, Dev Log, lint/build/test results, and `git diff main --stat`.
- Block PR creation if any required phase is incomplete.

## 9) PR Creation
- Create the PR from the current branch to `main`.
- Use `.github/PULL_REQUEST_TEMPLATE.md`.
- Do not merge the PR as part of this workflow.
