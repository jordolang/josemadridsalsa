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
  oxc: { tsconfig: false } as UserConfig['oxc'],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest-setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
})
