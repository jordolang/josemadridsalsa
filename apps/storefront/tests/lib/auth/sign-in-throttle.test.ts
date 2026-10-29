import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  RATE_LIMITS: {
    AUTH_LOGIN: { maxRequests: 5, windowSeconds: 900 },
    AUTH_LOGIN_IP: { maxRequests: 20, windowSeconds: 900 },
  },
}))

import bcrypt from 'bcryptjs'
import {
  compareAgainstDummyHash,
  getSignInClientIp,
  maskEmail,
  isSignInAllowed,
} from '@/lib/auth/sign-in-throttle'
import { checkRateLimit } from '@/lib/rate-limiter'

const allowed = { allowed: true, remaining: 4, resetIn: 900, current: 1 }
const blocked = { allowed: false, remaining: 0, resetIn: 600, current: 10 }

describe('getSignInClientIp', () => {
  it('takes the first x-forwarded-for entry', () => {
    expect(getSignInClientIp({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })).toBe('203.0.113.7')
  })

  it('reads array-valued headers', () => {
    expect(getSignInClientIp({ 'x-forwarded-for': ['203.0.113.7'] })).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip', () => {
    expect(getSignInClientIp({ 'x-real-ip': '198.51.100.2' })).toBe('198.51.100.2')
  })

  it('returns null without headers', () => {
    expect(getSignInClientIp(undefined)).toBeNull()
    expect(getSignInClientIp({})).toBeNull()
  })
})

describe('isSignInAllowed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('counts the attempt against the IP and the email', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(allowed)

    await expect(isSignInAllowed({ email: 'a@example.com', ip: '203.0.113.7' })).resolves.toBe(true)

    expect(checkRateLimit).toHaveBeenCalledWith({
      identifier: 'auth:login:ip:203.0.113.7',
      maxRequests: 20,
      windowSeconds: 900,
    })
    expect(checkRateLimit).toHaveBeenCalledWith({
      identifier: 'auth:login:a@example.com',
      maxRequests: 5,
      windowSeconds: 900,
    })
  })

  // Regression: credential stuffing tried ~3 passwords per email, under the
  // per-email limit, so only a per-IP limit stops it.
  it('blocks an IP that spreads attempts across many emails', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(blocked)

    await expect(isSignInAllowed({ email: 'new@example.com', ip: '203.0.113.7' })).resolves.toBe(false)
    // The email's allowance is not spent by a blocked IP.
    expect(checkRateLimit).toHaveBeenCalledTimes(1)
  })

  it('blocks an email that has hit its own limit', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(allowed).mockResolvedValueOnce(blocked)

    await expect(isSignInAllowed({ email: 'a@example.com', ip: '203.0.113.7' })).resolves.toBe(false)
  })

  it('still applies the email limit when the IP is unknown', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(blocked)

    await expect(isSignInAllowed({ email: 'a@example.com', ip: null })).resolves.toBe(false)
    expect(checkRateLimit).toHaveBeenCalledTimes(1)
    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'auth:login:a@example.com' })
    )
  })
})

describe('compareAgainstDummyHash', () => {
  it('runs a real bcrypt compare and always fails', async () => {
    const compare = vi.spyOn(bcrypt, 'compare')

    await expect(compareAgainstDummyHash('hunter2')).resolves.toBe(false)
    expect(compare).toHaveBeenCalledWith('hunter2', expect.stringMatching(/^\$2[aby]\$12\$/))
  }, 15_000)
})

describe('maskEmail', () => {
  it('keeps two characters and the domain', () => {
    expect(maskEmail('jordan@example.com')).toBe('jo***@example.com')
  })

  it('handles short and malformed addresses', () => {
    expect(maskEmail('j@example.com')).toBe('j***@example.com')
    expect(maskEmail('not-an-email')).toBe('***')
    expect(maskEmail('@example.com')).toBe('***')
  })
})
