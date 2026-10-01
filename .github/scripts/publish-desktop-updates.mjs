// Publishes a Desktop Apps build to the update feed both apps read.
//
//   node publish-desktop-updates.mjs <dir with the release files>
//
// The feed is the storefront's /api/desktop/updates/<file>, which redirects
// into the public Blob store under desktop/. GitHub releases cannot be the feed:
// the repository is private, so its assets answer 404 to an app with no GitHub
// session. Needs BLOB_READ_WRITE_TOKEN.
//
// Order matters. Installers go up first and latest.yml last, so an app that
// checks mid-publish never reads a manifest naming a file that is not there yet.
// Older builds are removed afterwards, keeping the store to one build.

import { del, list, put } from '@vercel/blob'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) throw new Error('usage: publish-desktop-updates.mjs <release dir>')
if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is not set')

const PREFIX = 'desktop/'
const files = (await readdir(dir)).sort()
if (!files.includes('latest.yml')) throw new Error(`no latest.yml in ${dir} — the feed would not change`)

const TYPES = { '.yml': 'text/yaml', '.exe': 'application/octet-stream', '.blockmap': 'application/octet-stream', '.dmg': 'application/x-apple-diskimage' }
const published = new Set()

async function upload(file, as = file) {
  const body = await readFile(join(dir, file))
  const blob = await put(`${PREFIX}${as}`, body, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    // The names are reused build after build, so the CDN may not hold one long.
    cacheControlMaxAge: 60,
    contentType: TYPES[as.slice(as.lastIndexOf('.'))] ?? 'application/octet-stream',
    multipart: body.length > 50 * 1024 * 1024,
  })
  published.add(blob.pathname)
  console.log(`published ${blob.pathname} (${(body.length / 1024 / 1024).toFixed(1)} MB)`)
}

for (const file of files) if (file !== 'latest.yml') await upload(file)

// Fixed names for a download by hand — a link that is always the current build.
const exe = files.find((file) => /^JoseMadridSalsaAdmin-Setup-.+\.exe$/.test(file))
const dmg = files.find((file) => /^JoseMadridSalsaAdmin-.+\.dmg$/.test(file))
if (exe) await upload(exe, 'JoseMadridSalsaAdmin-Setup-latest.exe')
if (dmg) await upload(dmg, 'JoseMadridSalsaAdmin-latest.dmg')

await upload('latest.yml')

// Everything else under desktop/ belongs to an older build.
let cursor
do {
  const page = await list({ prefix: PREFIX, cursor })
  const stale = page.blobs.filter((blob) => !published.has(blob.pathname)).map((blob) => blob.url)
  if (stale.length) {
    await del(stale)
    console.log(`removed ${stale.length} file(s) from older builds`)
  }
  cursor = page.hasMore ? page.cursor : undefined
} while (cursor)
