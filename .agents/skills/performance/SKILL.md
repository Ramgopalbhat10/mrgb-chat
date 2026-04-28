---
name: performance
description: Fix performance issues like slow queries, unnecessary re-renders, bundle bloat, or inefficient algorithms. Use when the user mentions latency, speed, optimization, caching improvements, or resource consumption.
metadata:
  author: mrgb
  version: "1.0"
---

# Performance Improvement

You are a performance-focused agent. Your mission is to analyze and fix a performance issue that impacts user experience or resource efficiency.

The user will provide task details: the file, performance issue description, relevant code snippet, and rationale.

If the user does not provide enough information, assume that you have access to the codebase and can investigate the issues yourself. Use your judgment to identify the bottleneck and implement an effective solution.

## Process

### 1. Understand
- Read the target files and understand the hot path or bottleneck.
- Identify the specific performance problem: unnecessary re-renders, redundant API calls, O(n²) loops, bundle size, memory leaks, etc.
- Determine if this is a latency, throughput, or resource consumption issue.

### 2. Assess Impact
- How does this affect real users (page load, interaction delay, server cost)?
- What is the current performance profile (if measurable)?
- Are there related performance issues nearby that should be fixed together?

### 3. Plan
- What is the target improvement?
- Consider trade-offs: caching vs freshness, code complexity vs speed, bundle size vs features.
- Prefer standard patterns (memoization, lazy loading, pagination) over clever optimizations.
- If the change affects caching/data-flow architecture, note that `docs/decisions/` may need updating.

### 4. Implement
- Use `.agents/skills/chat-workflow/SKILL.md` for repo routing, docs, quality gates, commit rules, and PR readiness before making edits.
- Classify this as an **Issue** (type: `performance`) per §2 of the workflow.
- Write the performance fix preserving existing behavior.
- Follow existing codebase patterns and conventions.
- Avoid premature optimization — fix the identified bottleneck, not hypothetical ones.

### 5. Verify
- Run `bun run lint`.
- Run `bun run build`.
- If the change affects tested behavior, run `bun run test`.
- Confirm the performance issue is resolved (describe how you validated, e.g., reduced bundle size, eliminated redundant calls).
- Confirm no functionality is broken.

### 6. Document
- Complete the `chat-workflow` post-code gate and keep the issue/progress docs in sync.
- If caching/data-flow architecture changed, add/update `docs/decisions/`.
- Commit with prefix: `fix:`, `refactor:`, or `chore:` based on the actual change.
- Use `.github/PULL_REQUEST_TEMPLATE.md` for any PR description.

Remember: Performance fixes must not change behavior. Measure before and after when possible. Avoid trading correctness for speed.
