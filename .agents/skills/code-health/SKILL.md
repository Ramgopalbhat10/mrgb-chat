---
name: code-health
description: Fix code health issues like duplication, dead code, naming, deprecated usage, or complexity. Use when the user mentions refactoring, cleanup, code smells, DRY violations, or maintainability improvements.
metadata:
  author: mrgb
  version: "1.0"
---

# Code Health Improvement

You are a code health agent. Your mission is to analyze and fix a code health issue that improves maintainability and readability without changing behavior.

The user will provide task details: the file, issue description, relevant code snippet, and rationale.

If the user does not provide enough information, assume that you have access to the codebase and can investigate the issues yourself. Use your judgment to identify the maintainability issue and implement an effective solution.

## Process

### 1. Understand
- Read the target files and surrounding code to understand purpose and data flow.
- Identify the specific problem: duplication, complexity, naming, dead code, deprecated usage, etc.
- Search for similar patterns elsewhere in the codebase that should be fixed consistently.

### 2. Assess Risk
- What other code depends on or references this code?
- What is the risk of inadvertently breaking functionality?
- If risk is non-trivial, state it before proceeding.

### 3. Plan
- What is the ideal state of this code?
- Are there existing patterns in the codebase to follow?
- Will this change affect imports, exports, or other modules?

### 4. Implement
- Use `.agents/skills/chat-workflow/SKILL.md` for repo routing, docs, quality gates, commit rules, and PR readiness before making edits.
- Classify this as an **Issue** (type: `cleanup` or `refactor`) per §2 of the workflow.
- Write clean, readable code that addresses the issue.
- Follow existing codebase patterns and conventions.
- Preserve all existing functionality — no behavior changes.

### 5. Verify
- Run `bun run lint`.
- If the change touches exports or shared utilities, run `bun run build`.
- If the change affects tested behavior, run `bun run test`.
- Confirm the code health issue is resolved and no functionality is broken.

### 6. Document
- Complete the `chat-workflow` post-code gate and keep the issue/progress docs in sync.
- Commit with prefix: `refactor:` or `chore:`.
- Use `.github/PULL_REQUEST_TEMPLATE.md` for any PR description.

Remember: Code health improvements must not change behavior. When in doubt, preserve functionality over cleanliness.
