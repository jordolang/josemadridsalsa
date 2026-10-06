import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Proxy = (request: NextRequest) => Promise<Response>

/**
 * The proxy fetches the CMS redirect table from an internal route and caches it
 * in module scope for 60 seconds. Each test therefore stubs the fetch and then
 * loads a *fresh* copy of the module, so one test's cached table cannot leak
 * into the next.
 */
async function loadProxy(
  redirects: Array<{ source: string; destination: string; permanent: boolean }> = []
): Promise<Proxy> {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ redirects }), { status: 200 }))
  )
  vi.resetModules()
  const mod = await import('@/proxy')
  return mod.default as Proxy
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.NEXT_PUBLIC_FUNDRAISING_SITE_URL
})

describe('storefront fundraising boundary', () => {
  it('redirects fundraiser pages to the fundraising site', async () => {
    const response = await (await loadProxy())(
      new NextRequest('https://www.josemadrid.net/fundraise/school?participant=abc')
    )

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(
      'https://fundraising.josemadrid.net/fundraise/school?participant=abc',
    )
  })

  it.each([
    '/arena/2026-fall',
    '/auth/fundraiser-signup',
    '/f/lincoln-band',
    '/fundraiser-portal/dashboard',
    '/fundraisers/lincoln-band',
    '/fundraising',
    '/game-icons/lorc/fire.svg',
    '/s/abc123',
  ])('redirects %s to the same path on the fundraising site', async (path) => {
    const response = await (await loadProxy())(new NextRequest(`https://www.josemadrid.net${path}`))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(`https://fundraising.josemadrid.net${path}`)
  })

  it('uses NEXT_PUBLIC_FUNDRAISING_SITE_URL', async () => {
    process.env.NEXT_PUBLIC_FUNDRAISING_SITE_URL = 'https://fundraising.josemadridsalsa.com'

    const response = await (await loadProxy())(new NextRequest('https://www.josemadridsalsa.com/fundraising'))

    expect(response.headers.get('location')).toBe('https://fundraising.josemadridsalsa.com/fundraising')
  })

  it('sends the old internal fundraising-site path to the fundraising host', async () => {
    const response = await (await loadProxy())(new NextRequest('https://www.josemadrid.net/fundraising-site/shop?a=b'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://fundraising.josemadrid.net/shop?a=b')
  })

  it('does not redirect main storefront pages', async () => {
    const response = await (await loadProxy())(new NextRequest('https://www.josemadrid.net/products'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('does not redirect lookalike paths', async () => {
    const response = await (await loadProxy())(new NextRequest('https://www.josemadrid.net/fundraisingfaq'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('does not redirect the fundraising host to itself', async () => {
    const response = await (await loadProxy())(new NextRequest('https://fundraising.josemadrid.net/fundraising'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('leaves the fundraiser mobile app API on this app', async () => {
    const response = await (await loadProxy())(new NextRequest('https://www.josemadrid.net/api/fundraiser-app/me'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})

describe('CMS redirects', () => {
  it('applies an active redirect with a 308 when permanent', async () => {
    const response = await (await loadProxy([{ source: '/old', destination: '/new', permanent: true }]))(new NextRequest('https://store.example.com/old'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://store.example.com/new')
  })

  it('uses a 307 for a temporary redirect', async () => {
    const response = await (await loadProxy([{ source: '/old', destination: '/new', permanent: false }]))(new NextRequest('https://store.example.com/old'))

    expect(response.status).toBe(307)
  })

  it('preserves the query string', async () => {
    const response = await (await loadProxy([{ source: '/old', destination: '/new', permanent: true }]))(new NextRequest('https://store.example.com/old?utm=abc'))

    expect(response.headers.get('location')).toBe('https://store.example.com/new?utm=abc')
  })

  it('matches regardless of a trailing slash', async () => {
    const response = await (await loadProxy([{ source: '/old', destination: '/new', permanent: true }]))(new NextRequest('https://store.example.com/old/'))

    expect(response.status).toBe(308)
  })

  it('redirects to an external destination', async () => {
    const response = await (await loadProxy([
      { source: '/docs', destination: 'https://example.org/docs', permanent: true },
    ]))(new NextRequest('https://store.example.com/docs'))

    expect(response.headers.get('location')).toBe('https://example.org/docs')
  })

  it('leaves unmatched paths alone', async () => {
    const response = await (await loadProxy([{ source: '/old', destination: '/new', permanent: true }]))(new NextRequest('https://store.example.com/something-else'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('never redirects API routes', async () => {
    const response = await (await loadProxy([{ source: '/api/thing', destination: '/new', permanent: true }]))(new NextRequest('https://store.example.com/api/thing'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('falls through when the redirect table times out', async () => {
    vi.resetModules()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const error = new Error('The operation was aborted due to timeout')
        error.name = 'TimeoutError'
        throw error
      })
    )
    const slowProxy = (await import('@/proxy')).default as Proxy

    const response = await slowProxy(new NextRequest('https://store.example.com/products'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('falls through when the redirect table cannot be loaded', async () => {
    vi.resetModules()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      })
    )
    const failingProxy = (await import('@/proxy')).default as Proxy

    const response = await failingProxy(new NextRequest('https://store.example.com/products'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})

describe('pathname forwarding', () => {
  it('sets x-pathname on the forwarded request so server components can read it', async () => {
    const response = await (await loadProxy())(new NextRequest('https://store.example.com/products/salsa'))

    // NextResponse.next({ request: { headers } }) encodes the overridden
    // request headers onto the response for the runtime to apply.
    expect(response.headers.get('x-middleware-override-headers')).toContain('x-pathname')
    expect(response.headers.get('x-middleware-request-x-pathname')).toBe('/products/salsa')
  })
})
