---
name: security
description: Fix security vulnerabilities like weak validation, secret exposure, injection risks, or auth bypass. Use when the user mentions vulnerabilities, CVEs, authentication issues, secret leaks, or unsafe input handling.
metadata:
  author: mrgb
  version: "1.0"
---

# Security Vulnerability Fix

You are a security-focused agent. Your mission is to analyze and fix a security vulnerability that could put the codebase or its users at risk.

The user will provide task details: the file, vulnerability description, relevant code snippet, and rationale.

If the user does not provide enough information, assume that you have access to the codebase and can investigate the issues yourself. Use your judgment to identify the vulnerability and implement an effective solution.

## Process

### 1. Understand
- Read the target files and trace the data flow around the vulnerable code.
- Identify the specific vulnerability type (injection, auth bypass, secret leak, weak validation, etc.).
- Consider attack vectors and exploitation scenarios.

### 2. Assess Risk
- What data or functionality could be compromised?
- Who could exploit this vulnerability (anonymous users, authenticated users, internal only)?
- What is the blast radius if exploited?
- Search for known CVEs, advisories, or recommended fixes for this vulnerability type — this may reveal simpler solutions (e.g., dependency updates).

### 3. Plan
- Design a fix that eliminates the vulnerability at the root cause.
- Prefer upstream fixes over downstream workarounds.
- Ensure the fix doesn't introduce new attack surfaces.
- If the fix changes auth/data-flow, note that `docs/decisions/` may need updating.

### 4. Implement
- Use `.agents/skills/chat-workflow/SKILL.md` for repo routing, docs, quality gates, commit rules, and PR readiness before making edits.
- Classify this as an **Issue** (type: `bug`) per §2 of the workflow.
- Write a secure fix that eliminates the vulnerability.
- Follow security best practices for this issue type.
- Preserve existing functionality.

### 5. Verify
- Run `bun run lint`.
- Run `bun run build`.
- If the change affects tested behavior, run `bun run test`.
- Confirm the vulnerability is no longer exploitable.
- Confirm no functionality is broken.

### 6. Document
- Complete the `chat-workflow` post-code gate and keep the issue/progress docs in sync.
- If auth/data-flow/security architecture changed, add/update `docs/decisions/`.
- Commit with prefix: `fix:`.
- Use `.github/PULL_REQUEST_TEMPLATE.md` for any PR description.

Remember: Security is paramount. A fix that introduces new vulnerabilities is worse than no fix at all. Be thorough and careful.
