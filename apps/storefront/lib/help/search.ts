import { z } from 'zod'

/** The salsadocs (apps/docs) deployment that hosts the customer knowledge base. */
export const SALSADOCS_URL = 'https://salsadocs.vercel.app'

/** Only pages under this path are customer-facing; everything else in salsadocs is internal. */
export const HELP_DOCS_PREFIX = '/docs/help'

const MAX_RESULTS = 8

export const helpQuerySchema = z.string().trim().min(1).max(100)

/** One hit from the Fumadocs search endpoint (fumadocs-core `SortedResult`). */
export interface DocsSearchHit {
  id: string
  url: string
  type: 'page' | 'heading' | 'text'
  content: string
}

export interface HelpArticleResult {
  title: string
  /** Absolute salsadocs URL, including any #heading anchor. */
  url: string
  /** The matching heading or paragraph, when the hit wasn't the page title. */
  snippet?: string
}

/**
 * Turn raw Fumadocs hits into a customer-safe result list.
 * Fumadocs returns hits in order: a 'page' hit, then that page's matching
 * 'heading'/'text' hits, then the next page, and so on.
 */
export function toHelpResults(hits: DocsSearchHit[]): HelpArticleResult[] {
  const results = new Map<string, HelpArticleResult>()

  for (const hit of hits) {
    const path = hit.url.split('#')[0]
    // Exact match or a child path — '/docs/helpers' must not slip through.
    if (path !== HELP_DOCS_PREFIX && !path.startsWith(`${HELP_DOCS_PREFIX}/`)) continue

    const existing = results.get(path)
    if (hit.type === 'page') {
      if (existing) existing.title = hit.content
      else results.set(path, { title: hit.content, url: `${SALSADOCS_URL}${hit.url}` })
    } else if (!existing) {
      results.set(path, { title: hit.content, url: `${SALSADOCS_URL}${hit.url}`, snippet: hit.content })
    } else if (!existing.snippet) {
      existing.snippet = hit.content
      existing.url = `${SALSADOCS_URL}${hit.url}`
    }
  }

  return [...results.values()].slice(0, MAX_RESULTS)
}

/**
 * Search the customer knowledge base. Returns null when salsadocs can't be
 * reached, so the page can say "search is unavailable" rather than "no results".
 */
export async function searchHelpArticles(query: string): Promise<HelpArticleResult[] | null> {
  try {
    const res = await fetch(`${SALSADOCS_URL}/api/search?query=${encodeURIComponent(query)}`, {
      next: { revalidate: 300 },
      // A slow docs deploy must not stall the whole /help page; the catch turns it into "unavailable".
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    return toHelpResults((await res.json()) as DocsSearchHit[])
  } catch {
    return null
  }
}
