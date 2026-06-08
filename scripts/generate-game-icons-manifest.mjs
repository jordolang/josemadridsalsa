import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const iconRoot = path.join(projectRoot, 'public', 'game-icons')
const manifestPath = path.join(projectRoot, 'public', 'game-icons-manifest.json')
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])

function tokenize(value) {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1)
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

    const pathSegments = relativePath.split(path.sep).map(encodeURIComponent)
    icons.push({
      name: path.parse(entry.name).name,
      path: `/game-icons/${pathSegments.join('/')}`,
      tags: [...new Set(tokenize(relativePath))],
    })
  }

  return icons
}

const icons = (await scan(iconRoot)).sort((a, b) => a.path.localeCompare(b.path))
await writeFile(manifestPath, `${JSON.stringify(icons)}\n`, 'utf8')
console.log(`Generated game icon manifest with ${icons.length} sprites.`)
