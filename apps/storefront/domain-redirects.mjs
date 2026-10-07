/**
 * Host redirects onto the canonical www.josemadridsalsa.com.
 *
 * - The bare josemadridsalsa.com goes to www.
 * - The old josemadrid.net and www.josemadrid.net go to the same path on
 *   www.josemadridsalsa.com, except /api: webhooks (Stripe, PayPal, Square,
 *   BigCommerce…) and the desktop and kiosk apps still call the old address and
 *   don't follow redirects. Other josemadrid.net subdomains are left alone.
 */

const CANONICAL_ORIGIN = 'https://www.josemadridsalsa.com'

/** @returns {import('next/dist/lib/load-custom-routes').Redirect[]} */
export function domainRedirects() {
  return [
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'josemadridsalsa.com' }],
      destination: `${CANONICAL_ORIGIN}/:path*`,
      permanent: true,
    },
    {
      source: '/:path((?!api(?:/|$)).*)',
      has: [{ type: 'host', value: '(?:www\\.)?josemadrid\\.net' }],
      destination: `${CANONICAL_ORIGIN}/:path`,
      permanent: true,
    },
  ]
}
