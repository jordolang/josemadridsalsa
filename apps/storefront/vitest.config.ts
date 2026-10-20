import { defineConfig } from 'vitest/config'
import type { UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { existsSync, statSync } from 'fs'

// `@/` resolves to this app first, then to packages/core, the same order as tsconfig's `paths`.
const aliasRoots = [path.resolve(__dirname, './'), path.resolve(__dirname, '../../packages/core')]
const aliasExtensions = ['', '.ts', '.tsx', '.js', '.mjs', '.jsx', '.json', '/index.ts', '/index.tsx', '/index.js']

function resolveAtAlias(id: string): string | null {
  const rest = id.slice(2)
  for (const root of aliasRoots) {
    for (const extension of aliasExtensions) {
      const candidate = path.join(root, rest + extension)
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
    }
  }
  return null
}

// Files that read and write the real database (gated on RUN_INTEGRATION_TESTS), and the shipping
// E2E files, which drive a running storefront backed by it.
const DATABASE_TESTS = [
  'tests/integration/checkout-reservation-flow.test.ts',
  'tests/integration/import-export-round-trip.test.ts',
  'tests/integration/inventory-alerts.test.ts',
  'tests/api/cms-page-save.test.ts',
  'tests/e2e/**/*.test.ts',
]

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'at-alias-with-core-fallback',
      enforce: 'pre',
      resolveId(id) {
        return id.startsWith('@/') ? resolveAtAlias(id) : null
      },
    },
  ],
  // Don't look up a tsconfig per transformed file. tests/lib/fundraiser-app imports helpers from
  // apps/fundraiser-app, whose tsconfig extends `expo/tsconfig.base`; CI doesn't install that app's
  // dependencies, so the lookup fails ("Tsconfig not found") and the whole run goes red. Vite's
  // OxcOptions type omits `tsconfig`, though the transform accepts it.
  oxc: { tsconfig: false } as UserConfig['oxc'],
  test: {
    globals: true,
    projects: [
      // Tests that use a real Postgres share one database, and some assertions query inventory
      // globally, so these files run one at a time, after everything else has finished.
      {
        extends: true,
        test: {
          name: 'database',
          include: DATABASE_TESTS,
          environment: 'node',
          setupFiles: ['./vitest-setup.ts'],
          fileParallelism: false,
        },
        sequence: { groupOrder: 1 },
      },
      // Component tests need a DOM. Everything else is plain logic and skips the cost of
      // building one per file; a .ts test that does need it opts in with
      // `// @vitest-environment jsdom` at the top.
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['tests/**/*.test.tsx'],
          exclude: DATABASE_TESTS,
          environment: 'jsdom',
          setupFiles: ['./vitest-setup.ts', './vitest-setup-dom.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: DATABASE_TESTS,
          environment: 'node',
          setupFiles: ['./vitest-setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      // Count packages/core too: its code was part of this app and is still tested from here.
      allowExternal: true,
      reporter: ['text', 'json', 'html', 'json-summary'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.{js,ts}',
        '**/dist/**',
        '**/.next/**',
        'scripts/',
        'prisma/',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 57,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@vercel/kv': path.resolve(__dirname, './tests/mocks/@vercel/kv.ts'),
    },
  },
})
