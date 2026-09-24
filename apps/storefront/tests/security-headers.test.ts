import { describe, it, expect, beforeEach, afterEach } from 'vitest'

/**
 * Security Headers Integration Tests
 *
 * Tests verify that security headers configured in next.config.mjs are
 * properly configured. Headers tested include:
 * - Content-Security-Policy
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - Referrer-Policy
 * - Permissions-Policy
 * - Strict-Transport-Security (production only)
 */

interface HeaderConfig {
  key: string
  value: string
}

interface RouteHeaderConfig {
  source: string
  headers: HeaderConfig[]
}

// Helper to get headers configuration from next.config.mjs
async function getHeadersConfig(nodeEnv: string): Promise<RouteHeaderConfig[]> {
  // Set environment before importing
  const originalEnv = process.env.NODE_ENV
  process.env.NODE_ENV = nodeEnv

  try {
    // Import config with environment set
    // Note: We can't reliably clear ESM module cache, so we test the function directly
    const config = await import('../next.config.mjs')
    const nextConfig = config.default

    // Call the headers function with the current environment
    const headers = await nextConfig.headers()
    return headers
  } finally {
    // Restore environment
    process.env.NODE_ENV = originalEnv
  }
}

describe('Security Headers Configuration', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    // Reset to development environment by default
    process.env.NODE_ENV = 'development'
  })

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv
  })

  // Helper to find header value in config
  function findHeader(headers: RouteHeaderConfig[], headerKey: string): string | null {
    for (const route of headers) {
      const header = route.headers.find((h) => h.key === headerKey)
      if (header) {
        return header.value
      }
    }
    return null
  }

  function getCspDirective(csp: string | null, directiveName: string): string[] {
    if (!csp) {
      return []
    }

    const directive = csp
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${directiveName} `))

    return directive?.split(/\s+/).slice(1) ?? []
  }

  describe('Content-Security-Policy', () => {
    it('should include default-src self directive', async () => {
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(csp).toContain("default-src 'self'")
    })

    it('should allow unsafe-inline for styles (Tailwind requirement)', async () => {
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    })

    it('should allow unsafe-eval for scripts in development', async () => {
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')
      const scriptSrc = getCspDirective(csp, 'script-src')

      expect(scriptSrc).toContain("'unsafe-eval'")
    })

    it('should NOT allow unsafe-eval for scripts in production', async () => {
      const headers = await getHeadersConfig('production')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(csp).toContain("script-src 'self'")
      expect(csp).not.toContain('unsafe-eval')
    })

    it('should allow required image sources', async () => {
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')
      const imgSrc = getCspDirective(csp, 'img-src')

      expect(csp).toContain('img-src')
      expect(imgSrc).toContain('https://utfs.io')
      expect(imgSrc).toContain('https://images.unsplash.com')
      expect(imgSrc).toContain('https://*.googleapis.com')
      expect(imgSrc).toContain('https://lh3.googleusercontent.com')
      expect(imgSrc).toContain('https://logo.clearbit.com')
      expect(imgSrc).toContain('https://www.google.com')
      expect(imgSrc).toContain('https://cdn11.bigcommerce.com')
      expect(imgSrc).toContain('data:')
      expect(imgSrc).toContain('blob:')
    })

    it('should allow Google Maps runtime sources without weakening unrelated directives', async () => {
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(getCspDirective(csp, 'script-src')).toContain('https://maps.googleapis.com')
      expect(getCspDirective(csp, 'script-src')).toContain('https://maps.gstatic.com')
      expect(getCspDirective(csp, 'frame-src')).toContain('https://maps.google.com')
      expect(getCspDirective(csp, 'img-src')).toContain('https://maps.gstatic.com')
      expect(getCspDirective(csp, 'style-src')).toContain('https://fonts.googleapis.com')
      expect(getCspDirective(csp, 'font-src')).toContain('https://fonts.gstatic.com')
      expect(getCspDirective(csp, 'object-src')).toEqual(["'none'"])
      expect(getCspDirective(csp, 'frame-ancestors')).toEqual(["'none'"])
    })

    it('should retain Vercel Toolbar source allowances', async () => {
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(getCspDirective(csp, 'style-src')).toContain('https://vercel.live')
      expect(getCspDirective(csp, 'script-src')).toContain('https://vercel.live')
      expect(getCspDirective(csp, 'frame-src')).toContain('https://vercel.live')
      expect(getCspDirective(csp, 'img-src')).toContain('https://vercel.live')
      expect(getCspDirective(csp, 'connect-src')).toContain('https://vercel.live')
      expect(getCspDirective(csp, 'font-src')).toContain('https://vercel.live')
    })

    it('should allow connections to self and Sentry', async () => {
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(csp).toContain("connect-src 'self' https://*.sentry.io")
    })

    it('should include frame-ancestors none directive', async () => {
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(csp).toContain("frame-ancestors 'none'")
    })

    it('should include upgrade-insecure-requests directive in production', async () => {
      const headers = await getHeadersConfig('production')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(csp).toContain('upgrade-insecure-requests')
    })

    it('should omit upgrade-insecure-requests in development', async () => {
      // Over http://localhost the directive upgrades every subresource to https,
      // which Safari honours for localhost — breaking CSS, JS, and media in dev.
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(csp).not.toContain('upgrade-insecure-requests')
    })

    it('should set object-src to none', async () => {
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(csp).toContain("object-src 'none'")
    })

    it('should set base-uri to self', async () => {
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(csp).toContain("base-uri 'self'")
    })

    it('should set form-action to self', async () => {
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(csp).toContain("form-action 'self'")
    })
  })

  describe('X-Frame-Options', () => {
    it('should be set to DENY', async () => {
      const headers = await getHeadersConfig('development')
      const xFrameOptions = findHeader(headers, 'X-Frame-Options')

      expect(xFrameOptions).toBe('DENY')
    })
  })

  describe('X-Content-Type-Options', () => {
    it('should be set to nosniff', async () => {
      const headers = await getHeadersConfig('development')
      const xContentTypeOptions = findHeader(headers, 'X-Content-Type-Options')

      expect(xContentTypeOptions).toBe('nosniff')
    })
  })

  describe('Referrer-Policy', () => {
    it('should be set to strict-origin-when-cross-origin', async () => {
      const headers = await getHeadersConfig('development')
      const referrerPolicy = findHeader(headers, 'Referrer-Policy')

      expect(referrerPolicy).toBe('strict-origin-when-cross-origin')
    })
  })

  describe('Permissions-Policy', () => {
    it('should restrict camera, microphone, and geolocation', async () => {
      const headers = await getHeadersConfig('development')
      const permissionsPolicy = findHeader(headers, 'Permissions-Policy')

      expect(permissionsPolicy).toContain('camera=()')
      expect(permissionsPolicy).toContain('microphone=()')
      expect(permissionsPolicy).toContain('geolocation=()')
    })
  })

  describe('Strict-Transport-Security', () => {
    it('should NOT be present in development', async () => {
      const headers = await getHeadersConfig('development')
      const hsts = findHeader(headers, 'Strict-Transport-Security')

      expect(hsts).toBeNull()
    })

    it('should be present in production with correct value', async () => {
      const headers = await getHeadersConfig('production')
      const hsts = findHeader(headers, 'Strict-Transport-Security')

      expect(hsts).toBe('max-age=31536000; includeSubDomains')
    })
  })

  describe('Route Pattern Coverage', () => {
    it('should apply headers to all routes via catch-all pattern', async () => {
      const headers = await getHeadersConfig('development')

      // The catch-all carries every security header and comes first.
      expect(headers[0].source).toBe('/(.*)')
    })

    it('limits later rules to the /waiver geolocation exception', async () => {
      const headers = await getHeadersConfig('development')

      // The photo-release kiosk location-stamps waivers, so /waiver alone may
      // use geolocation. Anything else here would widen permissions silently.
      expect(headers.slice(1)).toEqual([
        {
          source: '/waiver',
          headers: [{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' }],
        },
      ])
    })
  })

  describe('Header Completeness', () => {
    it('should include all required security headers in development', async () => {
      const headers = await getHeadersConfig('development')

      // All headers except HSTS should be present in development
      expect(findHeader(headers, 'Content-Security-Policy')).toBeTruthy()
      expect(findHeader(headers, 'X-Frame-Options')).toBeTruthy()
      expect(findHeader(headers, 'X-Content-Type-Options')).toBeTruthy()
      expect(findHeader(headers, 'Referrer-Policy')).toBeTruthy()
      expect(findHeader(headers, 'Permissions-Policy')).toBeTruthy()
      expect(findHeader(headers, 'Strict-Transport-Security')).toBeNull()
    })

    it('should include all required security headers in production', async () => {
      const headers = await getHeadersConfig('production')

      // All headers including HSTS should be present in production
      expect(findHeader(headers, 'Content-Security-Policy')).toBeTruthy()
      expect(findHeader(headers, 'X-Frame-Options')).toBeTruthy()
      expect(findHeader(headers, 'X-Content-Type-Options')).toBeTruthy()
      expect(findHeader(headers, 'Referrer-Policy')).toBeTruthy()
      expect(findHeader(headers, 'Permissions-Policy')).toBeTruthy()
      expect(findHeader(headers, 'Strict-Transport-Security')).toBeTruthy()
    })

    it('should have exactly 5 headers in development', async () => {
      const headers = await getHeadersConfig('development')

      // Count headers in the route config
      expect(headers[0].headers).toHaveLength(5)
    })

    it('should have exactly 6 headers in production', async () => {
      const headers = await getHeadersConfig('production')

      // Count headers in the route config (includes HSTS)
      expect(headers[0].headers).toHaveLength(6)
    })
  })
})
