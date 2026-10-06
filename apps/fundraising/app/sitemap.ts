import type { MetadataRoute } from 'next'
import { getFundraisingProducts } from '@/lib/fundraising-site/catalog'
import { getActiveFundraisingGroups } from '@/lib/fundraising-site/groups'
import { getFundraisingSiteUrl } from '@/lib/fundraising-site/host'
import { FUNDRAISING_STATIC_PAGES } from '@/lib/fundraising-site/pages'

export const revalidate = 3600

/**
 * Sitemap for the fundraising host, served at its /sitemap.xml by the proxy
 * rewrite. The main site's app/sitemap.ts covers www only. Product and group
 * pages come from the BigCommerce fundraising store, so a catalog or group
 * list that cannot be read leaves them out rather than failing the sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getFundraisingSiteUrl()
  const url = (path: string) => (path === '/' ? base : `${base}${path}`)

  const [products, groups] = await Promise.all([
    getFundraisingProducts().catch(() => []),
    getActiveFundraisingGroups().catch(() => []),
  ])

  return [
    ...FUNDRAISING_STATIC_PAGES.map((path) => ({ url: url(path), priority: path === '/' ? 1 : 0.6 })),
    { url: url('/shop'), priority: 0.9 },
    { url: url('/groups'), priority: 0.8 },
    { url: url('/battle-arena'), priority: 0.6 },
    ...products.map((product) => ({ url: url(`/shop/${product.slug}`), priority: 0.7 })),
    ...groups.map((group) => ({ url: url(`/groups/${group.slug}`), priority: 0.5 })),
  ]
}
