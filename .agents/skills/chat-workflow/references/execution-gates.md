# Execution Gates

## Pre-Code Gate

Before editing:
- Read `docs/PROGRESS.md` and the current story/issue file.
- Skim `docs/learnings/README.md` and relevant learning files.
- Read `docs/decisions/README.md` when architecture, caching, auth, AI routing, or data flow changes are involved.
- Run `git status --short --branch` and confirm the branch prefix is valid.
- Branch setup:
  - New work: `git switch main` -> `git pull --ff-only` -> `git switch -c <prefix>/<slug>`
  - Existing work: `git switch main` -> `git pull --ff-only` -> `git switch <prefix>/<slug>` -> `git merge main`
  - Wrong branch with work already started: `git switch -c <prefix>/<slug>` first, then merge `main` if needed
- Confirm the story/issue file exists and is listed in its index.
- Confirm `docs/PROGRESS.md` points at the correct story/issue and current section.

## Execute One Unit Of Work

- Keep scope tight to one legitimate unit of work.
- Keep the change aligned with the current section in `docs/PROGRESS.md`.
- When another repo-local skill applies, let that skill handle implementation details while this workflow still owns the gates.

## Post-Code Gate

After each unit:
- Update sub-tasks in the story/issue file.
- Add one `## Dev Log` row.
- Update `docs/PROGRESS.md` using strict task movement.
- Add or update issue/story cross-references when needed.
- Add decision records when architecture changes materially.
- Add learnings when a non-obvious lesson should carry forward.
- Verify the relevant story/issue index still includes the work.

## Quality Gate

- If code changed, run `bun run lint`.
- If the change is user-visible or risky, run `bun run build`.
- If the change touches tested behavior, run `bun run test`.
- Optional: run `bun run format` before committing when style drift is likely.
- If a check fails, fix it before continuing, or record the failure explicitly if the user wants a WIP state.

## Commit Rule

- Commit only on the current non-`main` branch.
- Use Conventional Commits with one of: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Do not use unsupported prefixes such as `perf:`.

## Pre-PR Verification

Before creating a PR, confirm:
- branch name uses an allowed prefix and is not `main`
- story/issue doc exists and is complete
- story/issue index is current
- `docs/PROGRESS.md` reflects the latest state
- `## Dev Log` has at least one row for the work
- `bun run lint` passed
- `bun run build` passed when required
- `bun run test` passed when the change affects tested behavior
- `git diff main --stat` shows only expected changes

Block PR creation if any required check is incomplete or failing.

## PR Creation

- Create the PR from the current branch to `main`.
- Use `.github/PULL_REQUEST_TEMPLATE.md`.
- Do not merge the PR as part of the workflow.

## Enforcement Alignment

Repo enforcement already exists in:
- `scripts/workflow/check-workflow-docs.mjs`
- `scripts/workflow/check-commit-message.mjs`
- `.githooks/pre-commit`
- `.githooks/commit-msg`
- `.githooks/pre-push`

If a human-facing doc and the enforced checks disagree, follow the enforced checks and then update the backup docs.
