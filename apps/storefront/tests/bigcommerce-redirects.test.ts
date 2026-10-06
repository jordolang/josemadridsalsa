import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { bigCommerceRedirects } from '@/bigcommerce-redirects.mjs'
import { BIGCOMMERCE_PRODUCT_SLUGS } from '@/lib/bigcommerce/product-map'

const redirects = bigCommerceRedirects(null)
const appDir = path.resolve(__dirname, '../app')
// Fundraiser pages such as /fundraising are served by apps/fundraising; proxy.ts sends them there.
const fundraisingAppDir = path.resolve(__dirname, '../../fundraising/app')

/** Whether this app, or the fundraising app it redirects to, serves `pathname` from a static route. */
function routeExists(pathname: string): boolean {
  if (pathname === '/sitemap.xml') return existsSync(path.join(appDir, 'sitemap.ts'))
  const segments = pathname.replace(/^\//, '')
  return [
    path.join(appDir, segments),
    path.join(appDir, '(public)', segments),
    path.join(fundraisingAppDir, '(site)', segments),
  ].some((dir) => existsSync(path.join(dir, 'page.tsx')))
}

describe('legacy BigCommerce redirects', () => {
  it('are all permanent, slash-free at the source and site-relative at the destination', () => {
    for (const redirect of redirects) {
      expect(redirect.permanent).toBe(true)
      expect(redirect.source).toMatch(/^\/[^?]*[^/]$/)
      expect(redirect.destination).toMatch(/^\/[^/]/)
    }
  })

  it('never redirect the same source twice unless a query condition tells them apart', () => {
    const unconditional = redirects.filter((redirect) => !redirect.has).map((redirect) => redirect.source)
    expect(new Set(unconditional).size).toBe(unconditional.length)
  })

  it('land on pages that exist', () => {
    const productSlugs = new Set(Object.values(BIGCOMMERCE_PRODUCT_SLUGS))
    for (const { destination } of redirects) {
      if (destination.startsWith('/products/') && destination !== '/products/search') {
        // Product pages are dynamic; the slug must be one the catalog maps.
        expect(productSlugs, destination).toContain(destination.slice('/products/'.length))
      } else {
        expect(routeExists(destination), destination).toBe(true)
      }
    }
  })

  it('never shadow a page this site already serves', () => {
    for (const { source } of redirects) {
      if (source.includes(':') || source.endsWith('.php')) continue
      expect(routeExists(source), source).toBe(false)
    }
  })

  it('send account-creation and balance links to their own pages ahead of the catch-alls', () => {
    const login = redirects.filter((redirect) => redirect.source === '/login.php')
    expect(login.map((redirect) => redirect.destination)).toEqual([
      '/auth/signup',
      '/auth/forgot-password',
      '/auth/signin',
    ])
    const gifts = redirects.filter((redirect) => redirect.source === '/giftcertificates.php')
    expect(gifts.map((redirect) => redirect.destination)).toEqual([
      '/gift-certificates/balance',
      '/gift-certificates/purchase',
    ])
    expect(redirects.at(-1)).toMatchObject({ source: '/blog/:path*', destination: '/heat-index' })
  })

  it('send account, sign-in, gift-certificate and wishlist links to the BigCommerce storefront once it has a subdomain', () => {
    const withStorefront = bigCommerceRedirects('https://shop.josemadridsalsa.com/')
    const owned = withStorefront.filter((redirect) => redirect.destination.startsWith('https://'))

    expect(owned).toEqual([
      { source: '/login.php', destination: 'https://shop.josemadridsalsa.com/login.php', permanent: false },
      { source: '/account.php', destination: 'https://shop.josemadridsalsa.com/account.php', permanent: false },
      { source: '/giftcertificates.php', destination: 'https://shop.josemadridsalsa.com/giftcertificates.php', permanent: false },
      { source: '/wishlist.php', destination: 'https://shop.josemadridsalsa.com/wishlist.php', permanent: false },
    ])
    // Everything else still lands here, and nothing is redirected twice.
    expect(withStorefront).toContainEqual({ source: '/cart.php', destination: '/cart', permanent: true })
    expect(withStorefront.filter((redirect) => redirect.source === '/login.php')).toHaveLength(1)
  })

  it('ignore a storefront setting that is not a URL', () => {
    expect(bigCommerceRedirects('shop')).toEqual(bigCommerceRedirects(null))
  })

  it('cover every legacy product and every mapped salsa', () => {
    const sources = new Set(redirects.map((redirect) => redirect.source))
    for (const legacy of ['/original-hot', '/choose-12', '/peach-mild-1', '/cranberry-1', '/purchase-salsa']) {
      expect(sources).toContain(legacy)
    }
    const destinations = new Set(redirects.map((redirect) => redirect.destination))
    for (const slug of Object.values(BIGCOMMERCE_PRODUCT_SLUGS)) {
      expect(destinations).toContain(`/products/${slug}`)
    }
  })
})
