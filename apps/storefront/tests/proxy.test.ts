import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Proxy = (request: NextRequest) => Promise<Response>

const originalFundraisingOrigin = process.env.FUNDRAISING_APP_ORIGIN

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
  if (originalFundraisingOrigin === undefined) {
    delete process.env.FUNDRAISING_APP_ORIGIN
  } else {
    process.env.FUNDRAISING_APP_ORIGIN = originalFundraisingOrigin
  }
})

describe('storefront fundraising boundary', () => {
  it('redirects fundraising pages to the fundraising application', async () => {
    process.env.FUNDRAISING_APP_ORIGIN = 'https://fundraising.example.com'

    const response = await (await loadProxy())(
      new NextRequest('https://store.example.com/fundraise/school?participant=abc')
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://fundraising.example.com/fundraise/school?participant=abc',
    )
  })

  it('does not redirect main storefront pages', async () => {
    process.env.FUNDRAISING_APP_ORIGIN = 'https://fundraising.example.com'

    const response = await (await loadProxy())(new NextRequest('https://store.example.com/products'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('does not redirect requests already on the fundraising origin', async () => {
    process.env.FUNDRAISING_APP_ORIGIN = 'https://fundraising.example.com'

    const response = await (await loadProxy())(new NextRequest('https://fundraising.example.com/fundraising'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('does not redirect a fundraising rewrite forwarded from the fundraising origin', async () => {
    process.env.FUNDRAISING_APP_ORIGIN = 'https://fundraising.example.com'

    const response = await (await loadProxy())(
      new NextRequest('https://store.example.com/fundraising', {
        headers: {
          'x-forwarded-host': 'fundraising.example.com',
        },
      }),
    )

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
