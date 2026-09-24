import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
