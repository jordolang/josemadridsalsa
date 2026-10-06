import { afterEach, describe, expect, it, vi } from 'vitest'

type Redirect = { source: string; destination: string; permanent: boolean }
type Rewrites = {
  beforeFiles: Array<{ source: string; destination: string }>
  afterFiles: Array<{ source: string; destination: string }>
}
type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> }

/** next.config.mjs reads NEXT_PUBLIC_SITE_URL at import time, so load a fresh copy per test. */
async function loadConfig() {
  vi.resetModules()
  const mod = await import('../next.config.mjs')
  const config = mod.default as {
    redirects: () => Promise<Redirect[]>
    rewrites: () => Promise<Rewrites>
    headers: () => Promise<HeaderRule[]>
  }
  return { redirects: await config.redirects(), rewrites: await config.rewrites(), headers: await config.headers() }
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL
})

describe('main-site pages', () => {
  it.each(['products', 'salsas', 'account', 'admin'])('sends /%s and its subpages to the main site', async (segment) => {
    const { redirects } = await loadConfig()

    expect(redirects).toContainEqual({
      source: `/${segment}`,
      destination: `https://www.josemadrid.net/${segment}`,
      permanent: false,
    })
    expect(redirects).toContainEqual({
      source: `/${segment}/:path*`,
      destination: `https://www.josemadrid.net/${segment}/:path*`,
      permanent: false,
    })
  })

  it('uses NEXT_PUBLIC_SITE_URL without a trailing slash', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.josemadridsalsa.com/'
    const { redirects, rewrites } = await loadConfig()

    expect(redirects).toContainEqual({
      source: '/products',
      destination: 'https://www.josemadridsalsa.com/products',
      permanent: false,
    })
    expect(rewrites.afterFiles).toContainEqual({
      source: '/images/:path*',
      destination: 'https://www.josemadridsalsa.com/images/:path*',
    })
  })

  it('never sends a fundraiser page to the main site', async () => {
    const { redirects } = await loadConfig()
    const sources = redirects.filter((r) => r.destination.startsWith('https://')).map((r) => r.source)

    for (const prefix of ['/fundraising', '/fundraisers', '/fundraise', '/fundraiser-portal', '/f', '/arena', '/s']) {
      expect(sources.some((source) => source === prefix || source.startsWith(`${prefix}/`))).toBe(false)
    }
  })
})

describe('old fundraiser order forms', () => {
  it.each([25, 16, 9])('points the %i-flavor zip at the 2026 kit', async (flavors) => {
    const { redirects } = await loadConfig()

    expect(redirects).toContainEqual({
      source: `/fundraising/downloads/${flavors}-flavor-fundraiser-forms.zip`,
      destination: `/fundraising/downloads/2026-Fundraiser-Kit-${flavors}-Flavors.zip`,
      permanent: true,
    })
  })

  it('only redirects to kit files that exist', async () => {
    const { existsSync } = await import('node:fs')
    const path = await import('node:path')
    const { redirects } = await loadConfig()

    for (const { destination } of redirects.filter((r) => r.destination.startsWith('/fundraising/downloads/'))) {
      expect(existsSync(path.join(__dirname, '../public', destination))).toBe(true)
    }
  })
})

describe('the Battle Arena game', () => {
  it('serves the built game at /battle-arena', async () => {
    const { existsSync } = await import('node:fs')
    const path = await import('node:path')
    const { rewrites } = await loadConfig()

    expect(rewrites.beforeFiles).toContainEqual({ source: '/battle-arena', destination: '/battle-arena/index.html' })
    expect(existsSync(path.join(__dirname, '../public/battle-arena/index.html'))).toBe(true)
    expect(existsSync(path.join(__dirname, '../public/battle-arena/og-image.jpg'))).toBe(true)
  })

  it('gives the game a policy that lets it reach the main site, its sounds and online rooms', async () => {
    const { headers } = await loadConfig()
    const csp = (rule: HeaderRule | undefined) => rule?.headers.find((h) => h.key === 'Content-Security-Policy')?.value

    const siteWide = headers.findIndex((r) => r.source === '/(.*)')
    const game = headers.findIndex((r) => r.source === '/battle-arena/:path*')
    // Next applies the last matching value, so the game's rule must come after the site-wide one.
    expect(game).toBeGreaterThan(siteWide)

    const policy = csp(headers[game])
    expect(policy).toContain("connect-src 'self' https://www.josemadrid.net ")
    expect(policy).toContain('https://d2ol7oe51mr4n9.cloudfront.net')
    expect(policy).toContain('wss://0.peerjs.com')
    expect(policy).toContain("frame-ancestors 'none'")
    expect(csp(headers[siteWide])).not.toContain('peerjs')
  })
})
