---
name: chat-workflow
description: Execute this repository's strict label-driven workflow, issue/story routing, progress tracking, documentation updates, quality gates, and PR readiness checks. Use for any non-`[ask]` task in this repo, including implementation, docs-only work, quality-only runs, commit/push requests, or whenever another repo-local skill needs the repo workflow rules.
---

# Chat Workflow

Follow this skill as the primary agent workflow source for this repository. Do not rely on `docs/WORKFLOW.md` or `docs/WORKFLOW_LABELS.md` for execution logic; those files are backup references for humans and reviewers.

## Start Here

1. Scan the request for a label before loading workflow context.
2. If the request is `[ask]` or clearly conversational with no repo mutations, answer directly and stop.
3. For every other request, use this skill to route the work, decide whether it is Story or Issue work, and enforce the repo's docs, branch, quality, commit, and PR gates.

## Workflow Decision Tree

### Request routing
- Read [request-routing.md](references/request-routing.md) for label handling, unlabeled request rules, and gap-fill behavior.

### Work tracking and docs
- Read [tracking-and-docs.md](references/tracking-and-docs.md) when the task is not `[ask]`.
- Use it to classify Story vs Issue, decide whether to reuse active work, create or update the correct docs, and keep `docs/PROGRESS.md` in sync.

### Execution gates
- Read [execution-gates.md](references/execution-gates.md) before edits and again before quality, commit, or PR actions.
- Treat repo-enforced checks in `scripts/workflow/` and `.githooks/` as the final source of truth if any wording drifts.

## Non-Negotiables

- Never commit directly to `main`.
- Use only `feature/`, `fix/`, `refactor/`, `chore/`, or `docs/` branches.
- Use `bun`, not `npm` or `pnpm`.
- Follow the existing testing conventions of the repo. `bun run test` is the canonical test command; do not add a new test framework without discussion.
- Block PR creation if any required phase is incomplete. List the missing phases instead of pushing through.

## Working With Other Repo Skills

- When a repo-local skill like `code-health`, `performance`, or `security` is active, let that skill drive the domain-specific implementation.
- Keep this skill responsible for request routing, work classification, progress/doc updates, quality gates, commit rules, and PR readiness.
