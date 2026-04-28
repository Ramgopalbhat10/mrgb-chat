#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const staged = args.includes('--staged')
const baseArg = args.find((arg) => arg.startsWith('--base='))
const headArg = args.find((arg) => arg.startsWith('--head='))
const branchArg = args.find((arg) => arg.startsWith('--branch='))

const base = baseArg ? baseArg.slice('--base='.length) : null
const head = headArg ? headArg.slice('--head='.length) : 'HEAD'
const branchFromArg = branchArg ? branchArg.slice('--branch='.length) : ''

const ALLOWED_BRANCH_PREFIXES = ['feature/', 'fix/', 'refactor/', 'chore/', 'docs/']

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim()
}

function fail(message, details = []) {
  console.error(`\n❌ ${message}`)
  if (details.length > 0) {
    for (const detail of details) {
      console.error(`   - ${detail}`)
    }
  }
  process.exit(1)
}

function detectCurrentBranch() {
  if (branchFromArg) {
    return branchFromArg
  }

  const fromGitBranch = run('git branch --show-current')
  if (fromGitBranch) {
    return fromGitBranch
  }

  const fromGitRef = run('git rev-parse --abbrev-ref HEAD')
  if (fromGitRef && fromGitRef !== 'HEAD') {
    return fromGitRef
  }

  const fromGithubHeadRef = process.env.GITHUB_HEAD_REF ?? ''
  if (fromGithubHeadRef) {
    return fromGithubHeadRef
  }

  const fromGithubRefName = process.env.GITHUB_REF_NAME ?? ''
  if (fromGithubRefName && fromGithubRefName !== 'HEAD') {
    return fromGithubRefName
  }

  return ''
}

function pass(message, details = []) {
  console.log(`✅ ${message}`)
  if (details.length > 0) {
    for (const detail of details) {
      console.log(`   - ${detail}`)
    }
  }
}

function getChangedFiles() {
  if (staged) {
    const output = run('git diff --cached --name-only --diff-filter=ACMRD')
    return output ? output.split('\n').filter(Boolean) : []
  }

  const targetBase = base ?? 'origin/main'
  try {
    const output = run(`git diff --name-only --diff-filter=ACMRD ${targetBase}...${head}`)
    return output ? output.split('\n').filter(Boolean) : []
  } catch {
    if (!base) {
      const fallback = run(`git diff --name-only --diff-filter=ACMRD main...${head}`)
      return fallback ? fallback.split('\n').filter(Boolean) : []
    }

    fail('Unable to compute changed files from the supplied base/head refs.', [
      `base=${targetBase}`,
      `head=${head}`,
      'Ensure the base ref exists locally (for CI, fetch with full history).',
    ])
  }

  return []
}

function getChangedEntries() {
  const parseNameStatus = (output) => {
    if (!output) {
      return []
    }

    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('\t').filter(Boolean)
        const status = parts[0] ?? ''
        const filePath = parts[parts.length - 1] ?? ''

        return {
          status,
          filePath,
        }
      })
      .filter((entry) => entry.filePath)
  }

  if (staged) {
    const output = run('git diff --cached --name-status --diff-filter=ACMRD')
    return parseNameStatus(output)
  }

  const targetBase = base ?? 'origin/main'
  try {
    const output = run(`git diff --name-status --diff-filter=ACMRD ${targetBase}...${head}`)
    return parseNameStatus(output)
  } catch {
    if (!base) {
      const fallback = run(`git diff --name-status --diff-filter=ACMRD main...${head}`)
      return parseNameStatus(fallback)
    }

    fail('Unable to compute changed file statuses from the supplied base/head refs.', [
      `base=${targetBase}`,
      `head=${head}`,
      'Ensure the base ref exists locally (for CI, fetch with full history).',
    ])
  }

  return []
}

function isDocumentationOnly(filePath) {
  return (
    filePath.startsWith('docs/') ||
    filePath.startsWith('.github/') ||
    filePath.endsWith('.md') ||
    filePath === 'AGENTS.md'
  )
}

function validateProgressFile() {
  const progressPath = 'docs/PROGRESS.md'
  let content = ''

  try {
    content = readFileSync(progressPath, 'utf8')
  } catch {
    fail('Required file docs/PROGRESS.md is missing.')
  }

  const requiredSections = [
    /^Current (story|issue):\s+`docs\/(stories|issues)\/.+`/m,
    /^Current section:\s+.+/m,
    /^Previous tasks \(latest completed batch only\):/m,
    /^Next tasks:/m,
    /^Notes:/m,
  ]

  const missing = requiredSections.filter((pattern) => !pattern.test(content))
  if (missing.length > 0) {
    fail('docs/PROGRESS.md does not match the required workflow structure.', [
      'Expected: Current story/issue, Current section, Previous tasks, Next tasks, Notes.',
    ])
  }
}

const changedFiles = getChangedFiles()
const changedEntries = getChangedEntries()

if (changedFiles.length === 0) {
  pass('Workflow documentation gate passed (no changed files detected).')
  process.exit(0)
}

// Branch prefix check runs for every non-empty diff (docs-only included) so the
// "never commit to main" rule applies to documentation updates as well.
const currentBranch = detectCurrentBranch()
if (!currentBranch) {
  pass('Branch prefix check skipped (unable to resolve branch in detached HEAD context).', [
    'This is expected in some CI environments.',
  ])
} else if (!ALLOWED_BRANCH_PREFIXES.some((prefix) => currentBranch.startsWith(prefix))) {
  fail('Current branch prefix is invalid.', [
    `branch=${currentBranch}`,
    'Allowed prefixes: feature/, fix/, refactor/, chore/, docs/',
    'Docs-only changes still require an allowed branch prefix (never commit directly to main).',
  ])
}

const implementationFiles = changedFiles.filter((filePath) => !isDocumentationOnly(filePath))
if (implementationFiles.length === 0) {
  pass('Workflow documentation gate passed (docs-only changes detected).', [
    'No implementation files changed, so workflow documentation linkage is not required.',
  ])
  process.exit(0)
}

const hasProgressChange = changedFiles.includes('docs/PROGRESS.md')
if (!hasProgressChange) {
  fail('Implementation changes require docs/PROGRESS.md updates.')
}

validateProgressFile()

const touchedStoryFiles = changedFiles.filter((filePath) => /^docs\/stories\/story-\d+\.md$/.test(filePath))
const touchedIssueFiles = changedFiles.filter((filePath) => /^docs\/issues\/issue-\d+\.md$/.test(filePath))
const addedStoryFiles = changedEntries.filter(
  (entry) => entry.status.startsWith('A') && /^docs\/stories\/story-\d+\.md$/.test(entry.filePath),
)
const addedIssueFiles = changedEntries.filter(
  (entry) => entry.status.startsWith('A') && /^docs\/issues\/issue-\d+\.md$/.test(entry.filePath),
)

if (touchedStoryFiles.length === 0 && touchedIssueFiles.length === 0) {
  fail('Implementation changes must update a story or issue document.', [
    'Expected at least one of:',
    'docs/stories/story-<N>.md',
    'docs/issues/issue-<N>.md',
  ])
}

if (addedStoryFiles.length > 0 && !changedFiles.includes('docs/stories/README.md')) {
  fail('New story files must include docs/stories/README.md index updates.')
}

if (addedIssueFiles.length > 0 && !changedFiles.includes('docs/issues/README.md')) {
  fail('New issue files must include docs/issues/README.md index updates.')
}

pass('Workflow documentation gate passed for implementation changes.', [
  `Implementation files checked: ${implementationFiles.length}`,
  `Story docs touched: ${touchedStoryFiles.length}`,
  `Issue docs touched: ${touchedIssueFiles.length}`,
])
