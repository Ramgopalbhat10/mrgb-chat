#!/usr/bin/env node

import { readFileSync } from 'node:fs'

const rawArgs = process.argv.slice(2)
const commitMessagePath = rawArgs.find((arg) => arg !== '--')

if (!commitMessagePath) {
  console.error('❌ Missing commit message file path argument.')
  console.error('   Usage: node scripts/workflow/check-commit-message.mjs <path-to-commit-msg-file>')
  process.exit(1)
}

const commitMessage = readFileSync(commitMessagePath, 'utf8').trim()
const firstLine = commitMessage.split('\n')[0] ?? ''

const allowed = /^(feat|fix|refactor|docs|chore)(\([^)]+\))?!?:\s.+/
const passthrough = /^(Merge|Revert)\b/

if (!allowed.test(firstLine) && !passthrough.test(firstLine)) {
  console.error('\n❌ Invalid commit message format.')
  console.error('   Expected: <type>(optional-scope): <summary>')
  console.error('   Allowed types: feat, fix, refactor, docs, chore')
  console.error(`   Received: ${firstLine || '(empty)'}`)
  process.exit(1)
}

console.log('✅ Commit message format passed.')
