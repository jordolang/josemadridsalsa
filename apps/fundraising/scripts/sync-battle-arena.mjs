// Copies a build of the Battle Arena game (index.html and og-image.jpg from a checkout of the
// battle-arena-3d repository) into public/battle-arena/, pointing its link-preview tags at
// this site instead of the game's own deployment.
// Usage (from apps/fundraising):  node scripts/sync-battle-arena.mjs ../../../battle-arena-3d
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const from = process.argv[2]
if (!from) {
  console.error('Usage: node scripts/sync-battle-arena.mjs <path to a battle-arena-3d checkout>')
  process.exit(1)
}

const site = (process.env.NEXT_PUBLIC_FUNDRAISING_SITE_URL?.trim() || 'https://fundraising.josemadrid.net').replace(/\/+$/, '')
const out = join(dirname(fileURLToPath(import.meta.url)), '../public/battle-arena')

const html = readFileSync(join(from, 'index.html'), 'utf8')
  .replace('<meta property="og:url" content="https://battle-arena-3d-mauve.vercel.app/">', `<meta property="og:url" content="${site}/battle-arena">`)
  .replace('<meta property="og:image" content="https://battle-arena-3d-mauve.vercel.app/og-image.jpg">', `<meta property="og:image" content="${site}/battle-arena/og-image.jpg">`)
writeFileSync(join(out, 'index.html'), html)
copyFileSync(join(from, 'og-image.jpg'), join(out, 'og-image.jpg'))
console.log(`synced: ${(html.length / 1024).toFixed(0)} KB into public/battle-arena/`)
