import { describe, expect, it } from 'vitest'
import { pathToRegexp } from 'next/dist/compiled/path-to-regexp'
import { domainRedirects } from '../domain-redirects.mjs'

/** Which redirect, if any, Next would apply to this host and path. */
function match(host: string, path: string) {
  for (const rule of domainRedirects()) {
    const hostPattern = new RegExp(`^${rule.has?.[0]?.value}$`)
    if (!hostPattern.test(host)) continue
    if (pathToRegexp(rule.source, [], { strict: true }).test(path)) return rule
  }
  return null
}

describe('domainRedirects', () => {
  it('sends the bare josemadridsalsa.com to www', () => {
    expect(match('josemadridsalsa.com', '/salsas')?.destination).toBe('https://www.josemadridsalsa.com/:path*')
    expect(match('josemadridsalsa.com', '/api/webhooks/stripe')).not.toBeNull()
  })

  it.each(['josemadrid.net', 'www.josemadrid.net'])('sends %s pages to www.josemadridsalsa.com', (host) => {
    expect(match(host, '/')?.destination).toBe('https://www.josemadridsalsa.com/:path')
    expect(match(host, '/salsas')).not.toBeNull()
    expect(match(host, '/apis-of-salsa')).not.toBeNull()
  })

  it.each(['/api', '/api/webhooks/stripe', '/api/desktop/updates/latest.yml'])(
    'leaves %s on www.josemadrid.net so webhooks keep working',
    (path) => {
      expect(match('www.josemadrid.net', path)).toBeNull()
    }
  )

  it('leaves www.josemadridsalsa.com and other josemadrid.net subdomains alone', () => {
    expect(match('www.josemadridsalsa.com', '/salsas')).toBeNull()
    expect(match('team.josemadrid.net', '/')).toBeNull()
    expect(match('fundraising.josemadridsalsa.com', '/')).toBeNull()
  })
})
