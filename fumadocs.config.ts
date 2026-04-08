import { defineConfig, Presets } from 'fumadocs-core/config'

export default defineConfig({
  baseUrl: '/docs',
  rootDir: 'content/docs',
  integrations: [
    Presets.github({
      owner: 'your-org',
      repo: 'josemadridsalsa',
    }),
  ],
})
