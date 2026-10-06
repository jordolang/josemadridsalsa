/**
 * A fundraiser's own search keywords, as they go into its public page's `<meta name="keywords">`.
 *
 * Trimmed, collapsed, de-duplicated (case-insensitively) and capped, so a pasted essay or a
 * repeated word cannot bloat every page load.
 */
export const MAX_SEO_KEYWORDS = 20
export const MAX_SEO_KEYWORD_LENGTH = 60

export function normalizeSeoKeywords(keywords: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of keywords ?? []) {
    const keyword = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_SEO_KEYWORD_LENGTH).trim()
    const key = keyword.toLowerCase()
    if (!keyword || seen.has(key)) continue
    seen.add(key)
    out.push(keyword)
    if (out.length === MAX_SEO_KEYWORDS) break
  }
  return out
}
