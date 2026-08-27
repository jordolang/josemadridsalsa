import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist/**', 'release/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        setTimeout: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
  },
  {
    files: ['src/main/**/*.ts', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', setInterval: 'readonly', __dirname: 'readonly' },
    },
  },
]
