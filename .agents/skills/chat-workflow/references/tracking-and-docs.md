# Tracking And Docs

## Classify The Work

- Use a **Story** for new features, feature enhancements, or other user-facing capability changes.
- Use an **Issue** for bugs, refactors, cleanup, tooling, performance work, workflow changes, or other non-feature work.

## Reuse Active Work First

Before creating new docs or branches:
1. Check `docs/stories/README.md`, `docs/issues/README.md`, and active branches.
2. Reuse an existing active story/issue and branch when the problem area matches.
3. Create a new story/issue and branch only when the request is genuinely different in scope or the previous work is already resolved.

## New Story Workflow

When the work is a new story:
1. Copy `docs/stories/template.md` to `docs/stories/story-<N>.md`.
2. Add the new row to `docs/stories/README.md`.
3. Create `feature/<slug>` from updated `main`.
4. Reset `docs/PROGRESS.md` to the new story and only the current workable sub-tasks.

## New Issue Workflow

When the work is a new issue:
1. Copy `docs/issues/template.md` to `docs/issues/issue-<N>.md`.
2. Remove template comments and placeholders.
3. Add the new row to `docs/issues/README.md`.
4. If it relates to a story, add cross-references in both files.
5. Create `fix/<slug>`, `refactor/<slug>`, `chore/<slug>`, or `docs/<slug>` from updated `main`.
6. Reset `docs/PROGRESS.md` to the new issue and only the current workable tasks.

## `docs/PROGRESS.md` Rules

Use this exact structure:

```md
Current story: `docs/stories/story-<N>.md`
Current section: Story N — <Title>
Previous tasks (latest completed batch only):
- [x] <task>
Next tasks:
- [ ] <task>
Notes:
- <context>
```

Or replace `story` with `issue` when tracking issue work.

Keep these invariants:
- `Previous tasks` contains only the latest completed batch.
- `Next tasks` contains only the current workable sub-task(s).
- When no work remains, set `Next tasks` to `- None - all tasks completed.`
- Keep the branch name in `Notes` when it helps the next session.

## Post-Work Doc Updates

After each real unit of work:
- Update story/issue sub-tasks from `[ ]` to `[x]` as applicable.
- Add one new `## Dev Log` row describing that unit.
- Move only the just-completed tasks from `Next tasks` to `Previous tasks`.
- Refill `Next tasks` with the next incomplete work only.
- Keep story/issue indexes current.
- If an issue relates to a story, keep the issue status and story Issues table in sync.
