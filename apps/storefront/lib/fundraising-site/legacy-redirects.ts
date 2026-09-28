/**
 * Where the old josemadridsalsafundraising.com URLs live on the new site, so
 * bookmarks, printed fliers and search results keep working once that domain
 * points here. Product pages move from `/<product>/` to `/shop/<product>`.
 */

const PAGE_ALIASES: Record<string, string> = {
  'shop-1': '/shop',
  'why-jose-madrid-for-fundraising': '/why-jose-madrid',
  'start-your-fundraiser': '/start',
  'fundraiser-sign-up': '/sign-up',
  'customer-testimonials-and-comments': '/testimonials',
  'customer-survey': '/survey',
  'contact-us': '/contact',
  'shipping-satisfaction': '/shipping',
  'shipping-returns': '/shipping',
  'cart.php': '/cart',
  'sitemap.php': '/',
  'search.php': '/shop',
  'brands': '/shop',
  'giftcertificates.php': '/shop',
}

/**
 * The new path for a legacy one, or null when there is none.
 *
 * @param segments the path segments after the host, e.g. `['original-mild-salsa']`
 * @param productSlugs every product slug the shop knows, hidden ones included
 */
export function resolveLegacyFundraisingPath(segments: string[], productSlugs: string[]): string | null {
  if (segments.length !== 1) return null
  const segment = segments[0].toLowerCase()
  if (PAGE_ALIASES[segment]) return PAGE_ALIASES[segment]
  if (productSlugs.includes(segment)) return `/shop/${segment}`
  return null
}
