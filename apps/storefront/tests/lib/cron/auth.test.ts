import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isAuthorizedCronRequest } from '@/lib/cron/auth'

const requestWith = (authorization?: string) =>
  new Request('https://example.com/api/cron/thing', {
    headers: authorization ? { authorization } : {},
  })

describe('isAuthorizedCronRequest', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 's3cret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepts the bearer token Vercel Cron sends', () => {
    expect(isAuthorizedCronRequest(requestWith('Bearer s3cret'))).toBe(true)
  })

  it('rejects a wrong token', () => {
    expect(isAuthorizedCronRequest(requestWith('Bearer wrong'))).toBe(false)
  })

  it('rejects a missing header', () => {
    expect(isAuthorizedCronRequest(requestWith())).toBe(false)
  })

  it('rejects the bare secret without the Bearer prefix', () => {
    expect(isAuthorizedCronRequest(requestWith('s3cret'))).toBe(false)
  })

  describe('when no secret is configured', () => {
    beforeEach(() => {
      vi.stubEnv('CRON_SECRET', '')
    })

    it('allows the call outside production, so local runs need no setup', () => {
      vi.stubEnv('NODE_ENV', 'development')
      expect(isAuthorizedCronRequest(requestWith())).toBe(true)
    })

    it('refuses in production rather than failing open', () => {
      // These routes send customer email. If the variable were ever dropped from the
      // project, failing open would leave them world-callable.
      vi.stubEnv('NODE_ENV', 'production')
      expect(isAuthorizedCronRequest(requestWith())).toBe(false)
      expect(isAuthorizedCronRequest(requestWith('Bearer anything'))).toBe(false)
    })
  })
})
