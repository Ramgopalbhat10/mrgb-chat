# TanStack Start + shadcn/ui

This is a template for a new TanStack Start project with React, TypeScript, and shadcn/ui.

## Development Workflow

This repository uses a label-driven agentic development workflow, mirrored from
`Ramgopalbhat10/notes`. The flow is enforced by git hooks and workflow scripts,
and is the source of truth for branch names, commit messages, docs updates,
quality gates, and PR readiness.

### First-time setup

```bash
bun install
git config core.hooksPath .githooks   # or: bun run hooks:install
```

The `.githooks/` directory contains `pre-commit`, `commit-msg`, and `pre-push`
hooks that run the workflow checks, lint, and build.

### Local auth bypass

For local development without GitHub OAuth credentials, set
`AUTH_BYPASS=true` in your shell or `.env.local`:

```bash
AUTH_BYPASS=true bun run dev
```

When the flag is on:

- `src/lib/auth.ts` does not construct the BetterAuth instance, so missing
  `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` no longer crash boot.
- `GET /api/auth/get-session` returns a synthetic local session
  (`local@example.com` / `Local Dev`).
- `requireAuth`/`getSession` short-circuit to that synthetic session, so
  protected API routes return 200 instead of 401.
- `/login` redirects to `/` automatically.

Leave `AUTH_BYPASS` unset (or set to anything other than `true`) to use the
normal GitHub OAuth flow.

### Where the rules live

- **Workflow router (always read first):** [`AGENTS.md`](AGENTS.md)
- **Primary agent workflow:** [`.agents/skills/chat-workflow/SKILL.md`](.agents/skills/chat-workflow/SKILL.md)
- **Human-facing backup:** [`docs/WORKFLOW.md`](docs/WORKFLOW.md)
- **Label reference:** [`docs/WORKFLOW_LABELS.md`](docs/WORKFLOW_LABELS.md)
- **Current focus:** [`docs/PROGRESS.md`](docs/PROGRESS.md)
- **Product/architecture context:** [`docs/PRD.md`](docs/PRD.md)
- **Historical progress log:** [`docs/PROGRESS_ARCHIVE.md`](docs/PROGRESS_ARCHIVE.md)

### Branch naming

Every non-`main` branch must use one of these prefixes:

- `feature/` — new features (stories)
- `fix/` — bug fixes (issues)
- `refactor/` — refactors (issues)
- `chore/` — tooling, workflow, deps (issues)
- `docs/` — documentation-only changes

Never commit directly to `main`.

### Commit messages (Conventional Commits)

Commit subjects must start with one of:

- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — refactor (no behavior change)
- `docs:` — documentation
- `chore:` — tooling / workflow / deps

The `commit-msg` hook enforces this. `Merge` and `Revert` commits are
passed through unchanged.

### Labels (what the agent scans for)

When you open a new request, prefix it with one of these labels to scope the
agent's behavior (see [`docs/WORKFLOW_LABELS.md`](docs/WORKFLOW_LABELS.md)):

- `[ask]` — answer only, no workflow context
- `[code-only]` — implementation only, skip docs/branch/quality/commit/PR
- `[docs-only]` — update story/issue docs only
- `[quality]` — run lint/build only
- `[commit]` — gap-fill missing phases, then commit
- `[push]` — gap-fill every phase, then open the PR

Unlabeled conversational requests behave as `[ask]`. Unlabeled implementation
requests run the full 9-phase workflow.

### Useful scripts

```bash
bun run dev                       # Vite dev server (port 3000)
bun run build
bun run lint
bun run format
bun run test
bun run workflow:check-docs       # run workflow checker against main...HEAD
bun run workflow:check-docs:staged  # same, but against the staged index
bun run workflow:check-commit-msg -- <path-to-commit-msg>
```
