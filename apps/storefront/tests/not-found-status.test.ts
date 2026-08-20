import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Guards the fix for storefront 404s that returned HTTP 200.
 *
 * A `loading.tsx` wraps its whole segment — and every route beneath it — in a
 * Suspense boundary. Combined with `export const dynamic = 'force-dynamic'` on
 * the public layout, Next flushes the shell before the page resolves, so a
 * later `notFound()` can no longer set the status: the response goes out as 200
 * carrying a 404 page. Google reads that as a soft 404.
 *
 * So: no `loading.tsx` may sit at or above a route that calls `notFound()`.
 * The check is structural because the failure is invisible in the rendered
 * output — only the status line is wrong.
 *
 * `/account` is exempt. It is behind a login, so no crawler reaches it and no
 * part of it is in the sitemap; the soft-404 problem needs a crawler to matter.
 * Its order pages do still answer a missing order with a 200, which is worth
 * knowing but is not worth trading the loading states of the most fetch-heavy
 * area of the site to fix.
 */

const APP_DIR = join(__dirname, '..', 'app')
const PUBLIC_DIR = join(APP_DIR, '(public)')

function walk(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else found.push(full)
  }
  return found
}

/** Login-gated subtrees, which no crawler can reach. See the note above. */
const UNCRAWLABLE = ['(public)/account/']

const publicFiles = walk(PUBLIC_DIR).filter(
  (file) => !UNCRAWLABLE.some((prefix) => relative(APP_DIR, file).startsWith(prefix))
)

const loadingSegments = publicFiles
  .filter((file) => file.endsWith('/loading.tsx'))
  .map((file) => file.slice(0, -'/loading.tsx'.length))

const notFoundPages = publicFiles.filter(
  (file) => file.endsWith('page.tsx') && readFileSync(file, 'utf8').includes('notFound()')
)

describe('storefront 404s return a 404 status', () => {
  it('has routes that call notFound(), so this guard is meaningful', () => {
    expect(notFoundPages.length).toBeGreaterThan(0)
  })

  it('has no loading.tsx wrapping a route that calls notFound()', () => {
    const conflicts = loadingSegments.flatMap((segment) =>
      notFoundPages
        .filter((page) => page.startsWith(`${segment}/`))
        .map(
          (page) =>
            `${relative(APP_DIR, segment)}/loading.tsx wraps ${relative(APP_DIR, page)}`
        )
    )

    expect(conflicts).toEqual([])
  })

  it('keeps a branded not-found at the root and in the public group', () => {
    const publicNotFound = publicFiles.some((file) => file.endsWith('(public)/not-found.tsx'))
    expect(publicNotFound).toBe(true)
    expect(() => statSync(join(APP_DIR, 'not-found.tsx'))).not.toThrow()
  })
})
