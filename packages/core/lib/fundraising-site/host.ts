/**
 * The fundraising site is its own app (apps/fundraising) on its own host:
 * fundraising.josemadridsalsa.com. The main site links to it, and sends its old
 * fundraiser paths there, through this origin.
 */

const DEFAULT_SITE_URL = 'https://fundraising.josemadridsalsa.com'

/** The fundraising site's canonical origin, e.g. for sitemaps and links from the main site. */
export function getFundraisingSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_FUNDRAISING_SITE_URL?.trim()
  return (configured || DEFAULT_SITE_URL).replace(/\/+$/, '')
}
