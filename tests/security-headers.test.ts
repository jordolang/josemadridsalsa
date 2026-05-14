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

      expect(csp).toContain("script-src 'self' 'unsafe-eval'")
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

      expect(csp).toContain('img-src')
      expect(csp).toContain('https://utfs.io')
      expect(csp).toContain('https://images.unsplash.com')
      expect(csp).toContain('https://*.googleapis.com')
      expect(csp).toContain('https://lh3.googleusercontent.com')
      expect(csp).toContain('https://logo.clearbit.com')
      expect(csp).toContain('https://www.google.com')
      expect(csp).toContain('https://cdn11.bigcommerce.com')
      expect(csp).toContain('data:')
      expect(csp).toContain('blob:')
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

    it('should include upgrade-insecure-requests directive', async () => {
      const headers = await getHeadersConfig('development')
      const csp = findHeader(headers, 'Content-Security-Policy')

      expect(csp).toContain('upgrade-insecure-requests')
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

      // Verify the route pattern is a catch-all
      expect(headers).toHaveLength(1)
      expect(headers[0].source).toBe('/(.*)')
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
