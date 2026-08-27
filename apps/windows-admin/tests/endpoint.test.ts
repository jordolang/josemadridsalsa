import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ENDPOINT,
  isAuthUrl,
  isInternalUrl,
  isLocalHost,
  isSafeExternalUrl,
  shouldOpenInApp,
  originOf,
  sectionUrl,
  validateEndpoint,
} from '../src/shared/endpoint'
import { ADMIN_SECTIONS } from '../src/shared/sections'
import { stripAppTokens } from '../src/shared/user-agent'

describe('validateEndpoint', () => {
  it('accepts the production admin URL', () => {
    expect(validateEndpoint(DEFAULT_ENDPOINT)).toEqual({ url: DEFAULT_ENDPOINT })
  })

  it('fills in /admin when only an origin is given', () => {
    expect(validateEndpoint('https://www.josemadrid.net')).toEqual({
      url: 'https://www.josemadrid.net/admin',
    })
  })

  it('keeps a deeper admin path', () => {
    expect(validateEndpoint('https://www.josemadrid.net/admin/orders')).toEqual({
      url: 'https://www.josemadrid.net/admin/orders',
    })
  })

  it('allows http only for local development servers', () => {
    expect(validateEndpoint('http://localhost:3000')).toEqual({ url: 'http://localhost:3000/admin' })
    expect(validateEndpoint('http://127.0.0.1:3000/admin')).toEqual({
      url: 'http://127.0.0.1:3000/admin',
    })
  })

  it('rejects plain http to a remote host', () => {
    const result = validateEndpoint('http://josemadrid.net/admin')
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/HTTPS is required/i)
  })

  it('rejects non-web protocols', () => {
    expect(validateEndpoint('file:///etc/passwd')).toHaveProperty('error')
    expect(validateEndpoint('javascript:alert(1)')).toHaveProperty('error')
  })

  it('rejects blank and unparseable input', () => {
    expect(validateEndpoint('   ')).toHaveProperty('error')
    expect(validateEndpoint('www.josemadrid.net')).toHaveProperty('error')
  })

  it('drops any query string or fragment', () => {
    expect(validateEndpoint('https://www.josemadrid.net/admin?tab=1#top')).toEqual({
      url: 'https://www.josemadrid.net/admin',
    })
  })

  it('trims surrounding whitespace', () => {
    expect(validateEndpoint('  https://www.josemadrid.net/admin  ')).toEqual({
      url: DEFAULT_ENDPOINT,
    })
  })
})

describe('isLocalHost', () => {
  it('recognises the local names, case-insensitively', () => {
    expect(isLocalHost('localhost')).toBe(true)
    expect(isLocalHost('LOCALHOST')).toBe(true)
    expect(isLocalHost('127.0.0.1')).toBe(true)
    expect(isLocalHost('josemadrid.net')).toBe(false)
  })
})

describe('navigation boundaries', () => {
  const endpoint = DEFAULT_ENDPOINT

  it('treats same-origin URLs as internal', () => {
    expect(isInternalUrl(endpoint, 'https://www.josemadrid.net/admin/orders')).toBe(true)
    expect(isInternalUrl(endpoint, 'https://www.josemadrid.net/')).toBe(true)
  })

  it('treats other origins as external, including sibling hosts', () => {
    expect(isInternalUrl(endpoint, 'https://josemadrid.net/admin')).toBe(false)
    expect(isInternalUrl(endpoint, 'https://dashboard.stripe.com/payments')).toBe(false)
    expect(isInternalUrl(endpoint, 'not a url')).toBe(false)
  })

  it('only hands http and https links to the operating system', () => {
    expect(isSafeExternalUrl('https://dashboard.stripe.com')).toBe(true)
    expect(isSafeExternalUrl('http://localhost:3002')).toBe(true)
    expect(isSafeExternalUrl('file:///C:/Windows/System32')).toBe(false)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('ms-settings:privacy')).toBe(false)
  })

  it('resolves section paths against the endpoint origin, not its path', () => {
    expect(sectionUrl('https://www.josemadrid.net/admin/orders', '/admin/financials')).toBe(
      'https://www.josemadrid.net/admin/financials'
    )
    expect(sectionUrl('http://localhost:3000/admin', '/admin/events')).toBe(
      'http://localhost:3000/admin/events'
    )
  })

  it('exposes the origin without a trailing path', () => {
    expect(originOf(DEFAULT_ENDPOINT)).toBe('https://www.josemadrid.net')
  })
})

describe('admin sections', () => {
  it('all point at admin paths', () => {
    for (const section of ADMIN_SECTIONS) {
      expect(section.path.startsWith('/admin')).toBe(true)
    }
  })

  it('has no duplicate paths or accelerators', () => {
    const paths = ADMIN_SECTIONS.map((section) => section.path)
    expect(new Set(paths).size).toBe(paths.length)

    const accelerators = ADMIN_SECTIONS.map((s) => s.accelerator).filter(Boolean)
    expect(new Set(accelerators).size).toBe(accelerators.length)
  })

  it('resolves every section to a URL on the configured origin', () => {
    for (const section of ADMIN_SECTIONS) {
      expect(isInternalUrl(DEFAULT_ENDPOINT, sectionUrl(DEFAULT_ENDPOINT, section.path))).toBe(true)
    }
  })
})

describe('sign-in providers', () => {
  const endpoint = DEFAULT_ENDPOINT

  it('keeps identity provider redirects inside the app window', () => {
    // An OAuth round trip that finishes in the default browser sets the session
    // cookie there, leaving the app stuck on the sign-in page.
    for (const url of [
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=x',
      'https://github.com/login/oauth/authorize?client_id=x',
      'https://www.facebook.com/v18.0/dialog/oauth',
      'https://appleid.apple.com/auth/authorize',
    ]) {
      expect(isAuthUrl(url)).toBe(true)
      expect(shouldOpenInApp(endpoint, url)).toBe(true)
    }
  })

  it('does not treat every Google or GitHub page as a sign-in flow', () => {
    expect(isAuthUrl('https://www.google.com/search?q=salsa')).toBe(false)
    expect(isAuthUrl('https://gist.github.com/example')).toBe(false)
    expect(isAuthUrl('https://accounts.google.com.evil.example/auth')).toBe(false)
  })

  it('still sends ordinary external links to the default browser', () => {
    expect(shouldOpenInApp(endpoint, 'https://dashboard.stripe.com/payments')).toBe(false)
    expect(shouldOpenInApp(endpoint, 'https://quickbooks.intuit.com')).toBe(false)
  })

  it('keeps admin pages in the app', () => {
    expect(shouldOpenInApp(endpoint, 'https://www.josemadrid.net/admin/orders')).toBe(true)
  })
})

describe('stripAppTokens', () => {
  const chrome =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

  it('removes the Electron and product tokens', () => {
    const electron =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) JoseMadridSalsaAdmin/2.0.0 Chrome/140.0.0.0 Electron/44.0.0 Safari/537.36'
    expect(stripAppTokens(electron, 'Jose Madrid Salsa Admin')).toBe(chrome)
  })

  it('removes a product token that kept its spaces', () => {
    const spaced =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Jose Madrid Salsa Admin/2.0.0 Chrome/140.0.0.0 Electron/44.0.0 Safari/537.36'
    expect(stripAppTokens(spaced, 'Jose Madrid Salsa Admin')).toBe(chrome)
  })

  it('leaves an already-clean user agent alone', () => {
    expect(stripAppTokens(chrome, 'Jose Madrid Salsa Admin')).toBe(chrome)
  })

  it('treats the app name as literal text, not as a pattern', () => {
    const ua = 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36'
    expect(stripAppTokens(ua, 'A.B (C)+')).toBe(ua)
  })
})
