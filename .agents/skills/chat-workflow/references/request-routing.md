# Request Routing

## Rule 1: Scan For A Label First

Inspect the request for one of these labels before loading workflow context:
- `[ask]`
- `[code-only]`
- `[docs-only]`
- `[quality]`
- `[commit]`
- `[push]`

If there is no label:
- Treat clearly conversational requests as `[ask]`.
- Treat implementation or repo-mutation requests as full workflow execution.

## Label Behavior

| Request form | Behavior |
|---|---|
| `[ask]` | Answer directly. Do not load `docs/PROGRESS.md`, workflow docs, or workflow references. |
| No label, conversational | Same as `[ask]`. |
| No label, implementation | Execute the full workflow. |
| `[code-only]` | Execute implementation only. Skip workflow docs updates, branch setup, quality, commit, and PR. |
| `[docs-only]` | Route/classify the request and update only the tracking docs. Do not implement code or run quality/commit/PR steps. |
| `[quality]` | Run only the quality gate: `bun run lint` and `bun run build` when applicable. |
| `[commit]` | Gap-fill phases 2, 3, 5, and 6 if incomplete, then commit on the current non-`main` branch. |
| `[push]` | Gap-fill every incomplete phase in order, then create the PR if every required gate passes. |

## Context Loading After Routing

For every non-`[ask]` task:
1. Open `docs/PROGRESS.md`.
2. Open the current story or issue file named there.
3. Skim `docs/learnings/README.md` and search related learning files.
4. Skim `docs/decisions/README.md` only when the change touches architecture, caching, auth, AI routing, or data flow.
5. Use `README.md`, story/issue indexes, and templates only as supporting repo artifacts, not as the source of workflow rules.

## Gap-Fill Rules

- `[commit]`: fill missing route/document, pre-code, post-code, and quality work before committing.
- `[push]`: fill every missing phase from route/document through pre-PR verification before creating a PR.
- If a dependency cannot be satisfied, stop and state the blocker instead of pretending the phase passed.
