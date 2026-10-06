import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const iconRoot = path.join(projectRoot, 'public', 'game-icons')
const manifestPath = path.join(projectRoot, 'public', 'game-icons-manifest.json')
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])
const remoteCatalogUrl =
  'https://api.github.com/repos/game-icons/icons/git/trees/master?recursive=1'

function tokenize(value) {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1)
}

function createIcon(relativePath) {
  const pathSegments = relativePath.split(/[\\/]/).map(encodeURIComponent)
  return {
    name: path.parse(relativePath).name,
    path: `/game-icons/${pathSegments.join('/')}`,
    tags: [...new Set(tokenize(relativePath))],
  }
}

async function scan(directory, relativeDirectory = '') {
  let entries

  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }

  const icons = []
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name)
    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      icons.push(...(await scan(absolutePath, relativePath)))
      continue
    }

    if (!entry.isFile() || !imageExtensions.has(path.extname(entry.name).toLowerCase())) continue
    icons.push(createIcon(relativePath))
  }

  return icons
}

async function loadRemoteIcons() {
  const response = await fetch(remoteCatalogUrl, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) {
    throw new Error(`Remote game icon catalog returned ${response.status}`)
  }

  const catalog = await response.json()
  return catalog.tree
    .filter(
      (entry) =>
        entry.type === 'blob' &&
        imageExtensions.has(path.extname(entry.path).toLowerCase())
    )
    .map((entry) => createIcon(entry.path))
}

async function loadCommittedManifest() {
  try {
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// The committed manifest is the source of truth: the icons themselves are not
// vendored, they are proxied from the upstream repo by app/game-icons/[...path].
// Builds must not depend on the unauthenticated GitHub API, which rate-limits
// Vercel's shared build IPs (403) and used to fail the deploy outright.
const refresh = process.argv.includes('--refresh')
let icons = await scan(iconRoot)

if (icons.length === 0 && !refresh) {
  icons = await loadCommittedManifest()
  if (icons.length > 0) {
    console.log(`Using the committed game icon manifest (${icons.length} sprites).`)
  }
}

if (icons.length === 0) {
  console.log('Loading the canonical remote catalog.')
  try {
    icons = await loadRemoteIcons()
  } catch (error) {
    icons = await loadCommittedManifest()
    if (icons.length === 0) throw error
    console.warn(`Remote catalog unavailable (${error.message}); keeping the committed manifest.`)
  }
}

icons.sort((a, b) => a.path.localeCompare(b.path))
await writeFile(manifestPath, `${JSON.stringify(icons)}\n`, 'utf8')
console.log(`Generated game icon manifest with ${icons.length} sprites.`)
