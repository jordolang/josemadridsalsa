import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface ChangelogItem {
  /** Full markdown text of the bullet, with wrapped continuation lines joined. */
  readonly text: string
  /** Nested sub-bullets (`  - ...`), each as joined markdown text. */
  readonly children: readonly string[]
}

export interface ChangelogSection {
  readonly type: 'Added' | 'Changed' | 'Fixed' | 'Removed' | 'Security'
  readonly items: readonly ChangelogItem[]
}

export interface ChangelogVersion {
  readonly version: string
  readonly date: string
  readonly subtitle: string
  readonly sections: readonly ChangelogSection[]
}

/**
 * Parse a keepachangelog.com formatted CHANGELOG.md into structured data.
 * Reads from the project root (or the monorepo root) at request time (RSC).
 * Returns an empty list rather than throwing when the file is unavailable, so
 * the /developer page renders even if the changelog cannot be located.
 *
 * Each location is a separate readFile call with a fully static path. A
 * computed/variable path would defeat @vercel/nft static analysis and cause it
 * to trace the entire project (the whole public/ tree) into this page's
 * serverless function, blowing past the size limit.
 */
export async function parseChangelog(): Promise<readonly ChangelogVersion[]> {
  // The storefront runs with cwd = apps/storefront.
  try {
    const content = await readFile(join(process.cwd(), 'CHANGELOG.md'), 'utf-8')
    return parseChangelogContent(content)
  } catch {
    // Fall back to the canonical CHANGELOG.md at the monorepo root.
  }
  try {
    const content = await readFile(join(process.cwd(), '..', '..', 'CHANGELOG.md'), 'utf-8')
    return parseChangelogContent(content)
  } catch {
    console.warn('[Developer] CHANGELOG.md not found; rendering empty changelog')
    return []
  }
}

export function parseChangelogContent(content: string): readonly ChangelogVersion[] {
  const lines = content.split('\n')
  const versions: ChangelogVersion[] = []
  let currentVersion: ChangelogVersion | null = null
  let currentSection: ChangelogSection | null = null
  // The bullet being built. Entries wrap over several indented lines and may
  // carry nested sub-bullets, so it is only committed when the next bullet,
  // heading or unindented line starts.
  let currentItem: { text: string; children: string[] } | null = null

  function flushItem() {
    if (currentItem && currentSection) {
      currentSection = {
        ...currentSection,
        items: [...currentSection.items, currentItem],
      }
    }
    currentItem = null
  }

  function flushSection() {
    flushItem()
    if (currentVersion && currentSection) {
      currentVersion = {
        ...currentVersion,
        sections: [...currentVersion.sections, currentSection],
      }
    }
    currentSection = null
  }

  for (const line of lines) {
    // Match version headers: ## [1.8.0] — 2026-04-01 — Multi-Payment & Optimization
    // Also handles: ## [Unreleased]
    const versionMatch = line.match(
      /^## \[([^\]]+)\](?:\s*[—–-]\s*(\d{4}-\d{2}-\d{2}))?\s*(?:[—–-]\s*(.+))?$/
    )
    if (versionMatch) {
      flushSection()
      if (currentVersion) {
        versions.push(currentVersion)
      }
      currentVersion = {
        version: versionMatch[1],
        date: versionMatch[2] ?? '',
        subtitle: versionMatch[3]?.trim() ?? '',
        sections: [],
      }
      continue
    }

    // Match section headers: ### Added, ### Changed, ### Fixed
    const sectionMatch = line.match(/^### (Added|Changed|Fixed|Removed|Security)\s*$/)
    if (sectionMatch && currentVersion) {
      flushSection()
      currentSection = {
        type: sectionMatch[1] as ChangelogSection['type'],
        items: [],
      }
      continue
    }

    if (!currentSection) continue

    // Top-level list item: - Item text
    const itemMatch = line.match(/^[-*] (.+)$/)
    if (itemMatch) {
      flushItem()
      currentItem = { text: itemMatch[1].trim(), children: [] }
      continue
    }

    if (!currentItem) continue

    // Nested list item:   - Sub-item text
    const childMatch = line.match(/^\s{2,}[-*] (.+)$/)
    if (childMatch) {
      currentItem.children.push(childMatch[1].trim())
      continue
    }

    // Wrapped continuation line: indented text belongs to the last bullet.
    const continuationMatch = line.match(/^\s{2,}(\S.*)$/)
    if (continuationMatch) {
      const text = continuationMatch[1].trim()
      const last = currentItem.children.length - 1
      if (last >= 0) {
        currentItem.children[last] = `${currentItem.children[last]} ${text}`
      } else {
        currentItem.text = `${currentItem.text} ${text}`
      }
      continue
    }

    // Blank lines may separate paragraphs of one entry; anything else ends it.
    if (line.trim() !== '') {
      flushItem()
    }
  }

  flushSection()
  if (currentVersion) {
    versions.push(currentVersion)
  }

  return versions
}
