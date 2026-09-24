/**
 * The site's public origin, e.g. `https://www.josemadrid.net`.
 *
 * Canonical links, the sitemap, structured data, feeds and email links all
 * build absolute URLs from this, so moving the site to another domain is a
 * change to `NEXT_PUBLIC_SITE_URL` in Vercel and a redeploy — no code edit.
 */
const DEFAULT_SITE_URL = 'https://www.josemadrid.net'

function normalizeOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

export const SITE_URL = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? DEFAULT_SITE_URL

/** The domain as shown to people, without `www.` — e.g. `josemadrid.net`. */
export const SITE_DOMAIN = new URL(SITE_URL).host.replace(/^www\./, '')
