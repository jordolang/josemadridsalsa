import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

/**
 * Read-only access to the Markdown documentation that lives inside this
 * repository, so the Developer Console can import it into Salsadocs.
 */

export interface RepoMarkdownFile {
  /** Path relative to the repository root, e.g. "README.md" */
  path: string
  name: string
  size: number
  modifiedAt: string
  title: string | null
}

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'dist',
  'build',
  'out',
  'coverage',
  'public',
  'data',
])

const MAX_DEPTH = 6
const MAX_FILES = 500
const MAX_FILE_BYTES = 1024 * 1024 // 1 MB

/**
 * Locate the repository root by walking up from the app directory until a
 * turbo.json is found (the storefront runs from apps/storefront).
 */
export function findRepoRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 4; i++) {
    if (existsSync(join(dir, 'turbo.json'))) {
      return dir
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

async function readTitle(filePath: string): Promise<string | null> {
  try {
    const handle = await fs.open(filePath, 'r')
    try {
      const buffer = Buffer.alloc(2048)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      const head = buffer.toString('utf-8', 0, bytesRead)
      const match = head.match(/^#[ \t]+(.+)$/m)
      return match ? match[1].trim() : null
    } finally {
      await handle.close()
    }
  } catch {
    return null
  }
}

/**
 * Recursively list Markdown files in the repository (root and subdirectories),
 * skipping dependency/build directories.
 */
export async function listRepoMarkdownFiles(): Promise<RepoMarkdownFile[]> {
  const root = findRepoRoot()
  const results: RepoMarkdownFile[] = []

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || results.length >= MAX_FILES) return

    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (results.length >= MAX_FILES) return
      if (entry.name.startsWith('.') && entry.name !== '.') continue

      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) {
          await walk(fullPath, depth + 1)
        }
        continue
      }

      if (!entry.isFile() || !/\.mdx?$/i.test(entry.name)) continue

      try {
        const stat = await fs.stat(fullPath)
        results.push({
          path: fullPath.slice(root.length + 1).split(sep).join('/'),
          name: entry.name,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          title: await readTitle(fullPath),
        })
      } catch {
        // Skip unreadable files
      }
    }
  }

  await walk(root, 0)
  return results.sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Read one Markdown file from the repository. The path must be relative,
 * stay inside the repository root, and point at a Markdown file.
 */
export async function readRepoMarkdownFile(relativePath: string): Promise<string> {
  const root = findRepoRoot()

  if (
    !relativePath ||
    relativePath.startsWith('/') ||
    relativePath.includes('\\') ||
    relativePath.split('/').some((segment) => segment === '..' || segment === '') ||
    !/\.mdx?$/i.test(relativePath)
  ) {
    throw new Error('Invalid markdown file path')
  }

  const fullPath = resolve(root, relativePath)
  if (!fullPath.startsWith(root + sep)) {
    throw new Error('Invalid markdown file path')
  }

  const stat = await fs.stat(fullPath)
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) {
    throw new Error('Markdown file is missing or too large')
  }

  return fs.readFile(fullPath, 'utf-8')
}
