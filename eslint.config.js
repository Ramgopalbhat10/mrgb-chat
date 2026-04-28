//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    name: 'mrgb-chat/ignores',
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      'src/routeTree.gen.ts',
      '.vercel/**',
      '.output/**',
      '.nitro/**',
      'dist/**',
      'drizzle/**',
    ],
  },
  {
    name: 'mrgb-chat/rule-overrides',
    files: ['**/*.{js,ts,tsx}'],
    rules: {
      // The TanStack preset enables `no-unnecessary-condition` as an error,
      // which has a high false-positive rate on defensive null/undefined
      // checks (e.g. when types come from external libraries with looser
      // runtime guarantees than their declared TS types). Demote to warn
      // so it surfaces in editors but does not block lint/CI.
      '@typescript-eslint/no-unnecessary-condition': 'warn',
    },
  },
]
