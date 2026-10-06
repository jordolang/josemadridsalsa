/**
 * The fundraising site is served by this app on its own host
 * (fundraising.josemadrid.net today, fundraising.josemadridsalsa.com once that
 * domain moves here). The proxy rewrites that host's paths into
 * `app/fundraising-site/`, so pages there are written with host-relative URLs
 * and must never be linked from the main storefront by their internal path.
 */

/** Internal route prefix the fundraising host is rewritten to. */
export const FUNDRAISING_SITE_PREFIX = '/fundraising-site'

const DEFAULT_SITE_URL = 'https://fundraising.josemadrid.net'

/** The fundraising site's canonical origin, e.g. for sitemaps and links from the main site. */
export function getFundraisingSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_FUNDRAISING_SITE_URL?.trim()
  return (configured || DEFAULT_SITE_URL).replace(/\/+$/, '')
}

/** Hosts that always serve the fundraising site. */
const DEFAULT_SITE_HOSTS = [
  'fundraising.josemadrid.net',
  'fundraising.josemadridsalsa.com',
  // Local development: http://fundraising.localhost:3000
  'fundraising.localhost',
]

/**
 * Whether a request host belongs to the fundraising site: the defaults above
 * plus any listed in FUNDRAISING_SITE_HOSTS (comma-separated) — e.g. the legacy
 * josemadridsalsafundraising.com once its DNS points here.
 */
export function isFundraisingSiteHost(host: string | null | undefined): boolean {
  if (!host) return false
  const hostname = host.toLowerCase().split(':')[0]
  const extra = (process.env.FUNDRAISING_SITE_HOSTS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return DEFAULT_SITE_HOSTS.includes(hostname) || extra.includes(hostname)
}
