import { defineConfig } from 'vitest/config'
import type { UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Don't look up a tsconfig per transformed file. tests/lib/fundraiser-app imports helpers from
  // apps/fundraiser-app, whose tsconfig extends `expo/tsconfig.base`; CI doesn't install that app's
  // dependencies, so the lookup fails ("Tsconfig not found") and the whole run goes red. Vite's
  // OxcOptions type omits `tsconfig`, though the transform accepts it.
  oxc: { tsconfig: false } as UserConfig['oxc'],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest-setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Run test files sequentially. The DB integration tests (inventory, checkout
    // reservation, order completion) share one Postgres and some assertions query
    // inventory globally, so overlapping files would contaminate each other. This
    // also removes the parallel-execution flakiness previously seen in the suite.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
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
      '@': path.resolve(__dirname, './'),
      '@vercel/kv': path.resolve(__dirname, './tests/mocks/@vercel/kv.ts'),
    },
  },
})
