/**
 * The fundraising site is its own app (apps/fundraising) on its own host:
 * fundraising.josemadrid.net today, fundraising.josemadridsalsa.com once that
 * domain moves. The main site links to it, and sends its old fundraiser paths
 * there, through this origin.
 */

const DEFAULT_SITE_URL = 'https://fundraising.josemadrid.net'

/** The fundraising site's canonical origin, e.g. for sitemaps and links from the main site. */
export function getFundraisingSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_FUNDRAISING_SITE_URL?.trim()
  return (configured || DEFAULT_SITE_URL).replace(/\/+$/, '')
}
