# Workflow Labels

This file is a human-facing backup reference. Agents should route requests with `.agents/skills/chat-workflow/SKILL.md`.

## Label → Phase Map

| Label | Runs | Gap-fills before? |
|---|---|---|
| `[ask]` | Answer only. No workflow context. | No |
| *(none, conversational)* | Same as `[ask]`. | No |
| *(none, implementation)* | Full workflow. | No |
| `[code-only]` | Implementation only. | No |
| `[docs-only]` | Route/document only. | No |
| `[quality]` | Quality gate only. | No |
| `[commit]` | Commit after filling missing route/document, pre-code, post-code, and quality phases. | Yes |
| `[push]` | PR creation after filling every incomplete phase. | Yes |

## Phase Summary

1. Mode
2. Route and document
3. Pre-code gate
4. Execute one unit of work
5. Post-code gate
6. Quality gate
7. Commit
8. Pre-PR verification
9. PR creation

## Guardrails

- Scan for labels before loading workflow context.
- Treat unlabeled conversational requests as `[ask]`.
- Treat unlabeled implementation requests as full workflow execution.
- Block PR creation when any required phase is incomplete.
