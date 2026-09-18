import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The App Router route table, read off disk rather than hardcoded, so a page
 * that is added, moved, or deleted is reflected without touching this file.
 *
 * A desktop `open` command is handed straight to `window.location.href`, so an
 * href that matches no route is a 404 the shell has no way to recover from.
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app')

const PAGE_FILE = /^page\.(tsx|ts|jsx|js)$/

function collect(dir: string, segments: string[], out: string[][]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  if (entries.some((entry) => entry.isFile() && PAGE_FILE.test(entry.name))) {
    out.push(segments)
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    // `_private` folders hold components, `@slots` are parallel routes.
    if (entry.name.startsWith('_') || entry.name.startsWith('.') || entry.name.startsWith('@')) continue
    // `(groups)` organise files without contributing a URL segment.
    const isGroup = entry.name.startsWith('(') && entry.name.endsWith(')')
    collect(join(dir, entry.name), isGroup ? segments : [...segments, entry.name], out)
  }
}

const ROUTE_PATTERNS: string[][] = []
collect(APP_DIR, [], ROUTE_PATTERNS)

/** Every registered `/admin` route, as readable patterns — useful in failure output. */
export const ADMIN_ROUTES: string[] = ROUTE_PATTERNS.filter((segments) => segments[0] === 'admin')
  .map((segments) => `/${segments.join('/')}`)
  .sort()

function matches(pattern: string[], parts: string[]): boolean {
  if (pattern.length === 0) return parts.length === 0

  const [head, ...rest] = pattern

  // `[[...slug]]` swallows zero or more segments, `[...slug]` one or more.
  if (head.startsWith('[[...')) {
    for (let i = 0; i <= parts.length; i++) if (matches(rest, parts.slice(i))) return true
    return false
  }
  if (head.startsWith('[...')) {
    for (let i = 1; i <= parts.length; i++) if (matches(rest, parts.slice(i))) return true
    return false
  }

  if (parts.length === 0) return false
  if (head.startsWith('[')) return matches(rest, parts.slice(1))
  return head === parts[0] && matches(rest, parts.slice(1))
}

/**
 * True when `href` resolves to a page that actually exists under `app/admin`.
 * Query strings and hashes are ignored — they do not affect which page renders.
 */
export function isRealAdminRoute(href: string): boolean {
  if (!href.split('#')[0].split('?')[0].startsWith('/admin')) return false
  return isRealAppRoute(href)
}

/**
 * True when `href` resolves to any page in this app, admin or storefront.
 *
 * The desktop shell links out to a few public pages — a product, a published
 * article — to show the operator what a customer sees. An absolute URL is
 * somebody else's site (a media CDN, Google Maps) and is not ours to check.
 */
export function isRealAppRoute(href: string): boolean {
  if (/^https?:\/\//.test(href)) return true

  const path = href.split('#')[0].split('?')[0]
  if (!path.startsWith('/')) return false

  const parts = path.split('/').filter(Boolean)
  return ROUTE_PATTERNS.some((pattern) => matches(pattern, parts))
}
