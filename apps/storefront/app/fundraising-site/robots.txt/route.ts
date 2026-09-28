import { getFundraisingSiteUrl } from '@/lib/fundraising-site/host'

/**
 * robots.txt for the fundraising host. The main site's app/robots.ts serves
 * www; the proxy rewrites this host's /robots.txt here. /api stays closed as
 * on www. The cart is kept out of the index by its own noindex tag, which
 * crawlers can only see if the page is not blocked here.
 */
export function GET() {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    `Sitemap: ${getFundraisingSiteUrl()}/sitemap.xml`,
    '',
  ].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
