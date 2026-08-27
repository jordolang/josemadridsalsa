import { cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// tsc only emits the compiled TypeScript. The app's own pages — the offline
// notice and the settings form — are plain HTML/CSS/JS and are copied across so
// dist/ is the complete, packageable app.
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const from = join(root, 'src', 'renderer')
const to = join(root, 'dist', 'renderer')

await mkdir(to, { recursive: true })
await cp(from, to, { recursive: true })

console.log(`Copied renderer assets to ${to}`)
