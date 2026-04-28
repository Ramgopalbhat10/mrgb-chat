# Story N — <Title>

Goal: <1-2 lines describing the user outcome.>

<!--
Notes:
- Copy this file to `docs/stories/story-<N>.md`.
- Update `docs/stories/README.md` to add the new story row.
- Use this as the default starting point after planning a new feature.
- Source template: `docs/stories/template.md`.
 - Initialize `docs/PROGRESS.md` with only Story N.1 sub-tasks (next incomplete section).
-->

## Scope
- In: <what is included>
- Out: <what is explicitly excluded>

## Deliverables
- <file/module changes>
- <new routes/components>
- <docs updates>

## Acceptance Criteria
- <measurable behavior>
- <measurable behavior>

## Dev Log

| Date | Unit | Summary |
|---|---|---|
| YYYY-MM-DD | feat | <what shipped in this unit of work> |

## Issues
<!-- Cross-references to related issues (bugs, refactors, perf fixes) filed against this story.
     Add a row when an issue is created that relates to this story. Keep Status in sync. -->

| Issue | Title | Status | File |
|---|---|---|---|

---

## Story N.1 — <Sub-Story Title>
- Components
  - `<path>`
- Behavior
  - <what changes>

Sub-tasks
- [ ] <task>
- [ ] <task>

Test Plan
- <manual or automated checks>

---

## Story N.2 — <Sub-Story Title>
- Components
  - `<path>`
- Behavior
  - <what changes>

Sub-tasks
- [ ] <task>

Test Plan
- <checks>

---

## Story N.3 — Verification and Regression Checks
- Components
  - `<path>`
- Behavior
  - Validate functional scenarios and ensure no regressions.

Sub-tasks
- [ ] Run `bun run lint`.
- [ ] Run `bun run build`.
- [ ] Run `bun run test` if applicable.

Test Plan
- <smoke test list>

---

## Definition of Done
- Acceptance criteria met.
- Dev Log updated for each unit of work.
- Progress updated in `docs/PROGRESS.md`.

## References
- <links to relevant docs/stories/PRs>
