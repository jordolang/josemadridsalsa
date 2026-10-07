/**
 * Permanent redirects from the legacy BigCommerce storefront's URLs, for when
 * josemadridsalsa.com points at this site. Search engines, bookmarks and old
 * printed links all carry these paths; each lands on its closest page here.
 *
 * Built from the old store's XML sitemaps (products, categories, pages, blog),
 * the catalog API (hidden products are not in the sitemap but may be
 * bookmarked) and BigCommerce's fixed system pages. The legacy URLs are frozen
 * at cutover, so this list does not need to follow later catalog changes.
 *
 * Next strips a trailing slash before applying these, so `/original-hot/`
 * reaches `/original-hot` first; sources are written without one.
 */

const product = (slug) => `/products/${slug}`

/** Legacy path → destination. */
const LEGACY_PATHS = {
  // Product pages (BigCommerce catalog, main store)
  '/black-bean-corn-pablano': product('black-bean-corn-salsa'),
  '/cherry-chocolate-hot': product('cherry-chocolate-hot'),
  '/cherry-mild': product('cherry-mild-salsa'),
  '/original-hot': product('original-hot'),
  '/chipotle-hot': product('chipotle-hot-salsa'),
  '/chipotle-con-queso': product('chipotle-con-queso-salsa'),
  '/clovis-medium-original-medium-chunky': product('clovis-medium-salsa'),
  '/original-x-hot': product('original-x-hot'),
  '/garden-fresh-cilantro-salsa-hot': product('garden-cilantro-hot-salsa'),
  '/original-mild': product('jose-madrid-original-mild'),
  '/garden-fresh-cilantro-salsa-mild': product('garden-cilantro-mild-salsa'),
  '/jamaican-jerk': product('jamaican-jerk-salsa'),
  '/mango-mild': product('mango-mild-salsa'),
  '/pineapple-mild': product('pineapple-mild-salsa'),
  '/raspberry-bbq-chipotle': product('raspberry-bbq-chipotle'),
  '/raspberry-mild': product('raspberry-mild-salsa'),
  '/roasted-garlic-olives': product('roasted-garlic-olives'),
  '/roasted-pineapple-habanero-hot': product('roasted-pineapple-habanero-hot'),
  '/strawberry-mild': product('strawberry-mild'),
  '/spanish-verde-hot': product('spanish-verde-hot'),
  '/spanish-verde-mild': product('spanish-verde-mild'),
  '/spanish-verde-x-x-hot': product('spanish-verde-xx-hot'),
  '/peach-mild-1': product('peach-mild-salsa'),
  '/mango-habanero': product('mango-habanero-salsa'),
  '/ghost-of-clovis': product('ghost-of-clovis'),
  '/cherry-hot': product('cherry-hot'),
  '/blueberry': product('blueberry-mild-salsa'),
  // Mix-and-match packs
  '/choose-5-with-gift-box': '/bundles',
  '/choose-12': '/bundles',
  '/temporarily-out-of-stock': '/bundles',
  '/choose-6': '/bundles',
  '/choose-5': '/bundles',
  // Seasonal flavors, hidden in BigCommerce and not sold here
  '/green-apple': '/salsas',
  '/pumpkin': '/salsas',
  '/cranberry-1': '/salsas',
  '/cranberry-chipotle': '/salsas',

  // Categories
  '/purchase-salsa': '/salsas',
  '/mix-and-match': '/bundles',
  '/individual-salsas': '/salsas',

  // Content pages: one info page per salsa, then the site pages
  '/chipotle-con-queso-1': product('chipotle-con-queso-salsa'),
  '/cherry-chocolate-hot-1': product('cherry-chocolate-hot'),
  '/pineapple-mild-1': product('pineapple-mild-salsa'),
  '/strawberry-mild-1': product('strawberry-mild'),
  '/raspberry-bbq-chipotle-1': product('raspberry-bbq-chipotle'),
  '/garden-cilantro-salsa-hot-1': product('garden-cilantro-hot-salsa'),
  '/spanish-verde-hot-1': product('spanish-verde-hot'),
  '/garden-cilantro-salsa-mild-1': product('garden-cilantro-mild-salsa'),
  '/peach-mild': product('peach-mild-salsa'),
  '/roasted-pineapple-habanero-hot-1': product('roasted-pineapple-habanero-hot'),
  '/mango-habanero-1': product('mango-habanero-salsa'),
  '/cherry-mild-1': product('cherry-mild-salsa'),
  // The Clovis pages are titled Original Mild / Hot / X-Hot on the old store.
  '/clovis-mild-1': product('jose-madrid-original-mild'),
  '/clovis-medium-1': product('clovis-medium-salsa'),
  '/clovis-hot-1': product('original-hot'),
  '/clovis-x-hot-1': product('original-x-hot'),
  '/jamaican-jerk-hot-1': product('jamaican-jerk-salsa'),
  '/roasted-garlic-olives-1': product('roasted-garlic-olives'),
  '/ghost-of-clovis-1': product('ghost-of-clovis'),
  '/spanish-verde-xx-hot': product('spanish-verde-xx-hot'),
  '/black-bean-and-corn': product('black-bean-corn-salsa'),
  '/raspberry-mild-1': product('raspberry-mild-salsa'),
  '/mango-mild-1': product('mango-mild-salsa'),
  '/spanish-verde-mild-1': product('spanish-verde-mild'),
  '/chipotle-hot-1': product('chipotle-hot-salsa'),
  '/cranberry': '/salsas',
  '/pumpkin-1': '/salsas',
  '/cranberry-chipotle-1': '/salsas',
  '/green-apple-1': '/salsas',
  '/our-salsas': '/salsas',
  '/wheres-jose': '/where-is-jose',
  '/about-jose': '/our-story',
  '/find-us-locally': '/find-us',
  '/fundraiser-testimonials': '/fundraising',
  '/fundraise-with-jose': '/fundraising',
  // /contact, /recipes and /wholesale exist here under the same path.

  // Blog
  '/blog/available-at-the-following-retail-locations': '/find-us',

  // BigCommerce system pages
  '/cart.php': '/cart',
  '/account.php': '/account',
  '/wishlist.php': '/wishlist',
  '/search.php': '/products/search',
  '/compare': '/salsas',
  '/brands': '/salsas',
  '/sitemap.php': '/sitemap.xml',
  '/xmlsitemap.php': '/sitemap.xml',
}

/**
 * Where an old product link under `/products/` should go when its slug is no
 * longer a product here. Product slugs used to be the BigCommerce ones
 * (`/products/cherry-mild`), and links built from them still live in places
 * that are slow to refresh, such as the Meta (Facebook/Instagram Shop) catalog.
 * Returns null for anything that is not an old product or catalog page.
 *
 * @param {string} slug
 * @returns {string | null}
 */
export function legacyProductDestination(slug) {
  const destination = LEGACY_PATHS[`/${slug}`]
  if (!destination || destination === `/products/${slug}`) return null
  return /^\/(products\/|salsas$|bundles$)/.test(destination) ? destination : null
}

/**
 * BigCommerce pages that stay BigCommerce's after cutover: customer sign-in,
 * account and order history, gift certificates, and wishlists. Once the old
 * storefront is moved to its own subdomain (`BIGCOMMERCE_STOREFRONT_URL`, e.g.
 * https://shop.josemadridsalsa.com), links to them go there with their query
 * string intact, so a customer reaches their real BigCommerce account.
 */
const BIGCOMMERCE_OWNED_PAGES = ['/login.php', '/account.php', '/giftcertificates.php', '/wishlist.php']

function storefrontOrigin(value) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

/** @returns {Array<{source: string, destination: string, permanent: boolean, has?: unknown[]}>} */
export function bigCommerceRedirects(storefrontUrl = process.env.BIGCOMMERCE_STOREFRONT_URL) {
  const storefront = storefrontOrigin(storefrontUrl)
  if (storefront) {
    // Temporary: the subdomain is a choice that may change, and browsers cache
    // permanent redirects indefinitely.
    const owned = BIGCOMMERCE_OWNED_PAGES.map((source) => ({
      source,
      destination: `${storefront}${source}`,
      permanent: false,
    }))
    return [
      ...owned,
      ...bigCommerceRedirects(null).filter((redirect) => !BIGCOMMERCE_OWNED_PAGES.includes(redirect.source)),
    ]
  }

  return [
    // Query-specific system pages first: Next applies the first match.
    {
      source: '/login.php',
      has: [{ type: 'query', key: 'action', value: 'create_account' }],
      destination: '/auth/signup',
      permanent: true,
    },
    {
      source: '/login.php',
      has: [{ type: 'query', key: 'action', value: 'reset_password' }],
      destination: '/auth/forgot-password',
      permanent: true,
    },
    { source: '/login.php', destination: '/auth/signin', permanent: true },
    {
      source: '/giftcertificates.php',
      has: [{ type: 'query', key: 'action', value: 'balance' }],
      destination: '/gift-certificates/balance',
      permanent: true,
    },
    { source: '/giftcertificates.php', destination: '/gift-certificates/purchase', permanent: true },
    ...Object.entries(LEGACY_PATHS).map(([source, destination]) => ({ source, destination, permanent: true })),
    // Anything else under the old blog lands on the editorial section.
    { source: '/blog/:path*', destination: '/heat-index', permanent: true },
  ]
}
