import { describe, expect, it } from 'vitest'

import {
  base32Decode,
  base32Encode,
  buildOtpAuthUri,
  constantTimeEquals,
  counterForTime,
  generateHotp,
  generateRecoveryCodes,
  generateTotp,
  generateTotpSecret,
  normalizeRecoveryCode,
  verifyTotp,
  TOTP_PERIOD_SECONDS,
} from '@/lib/auth/totp'

/**
 * The seed from RFC 6238 Appendix B / RFC 4226 Appendix D, base32-encoded as an
 * authenticator app would hold it.
 */
const RFC_SECRET_ASCII = '12345678901234567890'
const RFC_SECRET = base32Encode(Buffer.from(RFC_SECRET_ASCII, 'ascii'))

describe('base32', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = Buffer.from([0x00, 0x01, 0x7f, 0x80, 0xff, 0xaa, 0x55])
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes)
  })

  it('matches the RFC 4648 test vectors', () => {
    expect(base32Encode(Buffer.from('f'))).toBe('MY')
    expect(base32Encode(Buffer.from('fo'))).toBe('MZXQ')
    expect(base32Encode(Buffer.from('foo'))).toBe('MZXW6')
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI')
  })

  it('accepts the spaced lower-case form apps display', () => {
    expect(base32Decode('mzxw 6ytb oi')).toEqual(Buffer.from('foobar'))
  })

  it('tolerates padding', () => {
    expect(base32Decode('MZXW6YTBOI======')).toEqual(Buffer.from('foobar'))
  })

  it('rejects characters outside the alphabet', () => {
    // 0/1/8/9 are excluded from base32 precisely because they are confusable.
    expect(() => base32Decode('MZXW6YTB01')).toThrow(/Invalid base32/)
  })
})

describe('HOTP — RFC 4226 Appendix D test vectors', () => {
  // If these pass, the truncation and HMAC are correct by definition of the spec.
  const expected = [
    '755224',
    '287082',
    '359152',
    '969429',
    '338314',
    '254676',
    '287922',
    '162583',
    '399871',
    '520489',
  ]

  it.each(expected.map((code, counter) => [counter, code]))(
    'counter %i produces %s',
    (counter, code) => {
      expect(generateHotp(RFC_SECRET, counter as number)).toBe(code)
    }
  )
})

describe('TOTP — RFC 6238 Appendix B test vectors', () => {
  // Published 8-digit SHA-1 vectors. Matching these is the whole basis for trusting this
  // implementation rather than a third-party library.
  const vectors: [number, string][] = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ]

  it.each(vectors)('time %i produces %s', (seconds, code) => {
    expect(generateTotp(RFC_SECRET, seconds * 1000, { digits: 8 })).toBe(code)
  })

  it('handles times beyond the 32-bit epoch', () => {
    // 20000000000 is past 2038; a counter written as a single 32-bit value would wrap.
    expect(generateTotp(RFC_SECRET, 20000000000 * 1000, { digits: 8 })).toBe('65353130')
  })
})

describe('counterForTime', () => {
  it('advances once per period and is stable within one', () => {
    const base = 1_700_000_000_000
    expect(counterForTime(base)).toBe(counterForTime(base + 1000))
    expect(counterForTime(base + TOTP_PERIOD_SECONDS * 1000)).toBe(counterForTime(base) + 1)
  })
})

describe('verifyTotp', () => {
  const now = 1_700_000_000_000
  const secret = generateTotpSecret()

  it('accepts the current code', () => {
    expect(verifyTotp(secret, generateTotp(secret, now), now)).toBe(true)
  })

  it('accepts one step of clock drift in each direction', () => {
    const period = TOTP_PERIOD_SECONDS * 1000
    expect(verifyTotp(secret, generateTotp(secret, now - period), now)).toBe(true)
    expect(verifyTotp(secret, generateTotp(secret, now + period), now)).toBe(true)
  })

  it('rejects a code two steps out', () => {
    const period = TOTP_PERIOD_SECONDS * 1000
    expect(verifyTotp(secret, generateTotp(secret, now - 2 * period), now)).toBe(false)
  })

  it('rejects a code from a different secret', () => {
    expect(verifyTotp(secret, generateTotp(generateTotpSecret(), now), now)).toBe(false)
  })

  it('accepts a code typed with a space', () => {
    const code = generateTotp(secret, now)
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now)).toBe(true)
  })

  it('rejects malformed input without throwing', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34', '   ']) {
      expect(verifyTotp(secret, bad, now)).toBe(false)
    }
  })
})

describe('generateTotpSecret', () => {
  it('produces a decodable 160-bit secret', () => {
    const secret = generateTotpSecret()
    expect(base32Decode(secret)).toHaveLength(20)
  })

  it('does not repeat', () => {
    const secrets = new Set(Array.from({ length: 50 }, () => generateTotpSecret()))
    expect(secrets.size).toBe(50)
  })
})

describe('constantTimeEquals', () => {
  it('compares equal and unequal values', () => {
    expect(constantTimeEquals('123456', '123456')).toBe(true)
    expect(constantTimeEquals('123456', '123457')).toBe(false)
  })

  it('returns false on length mismatch instead of throwing', () => {
    // timingSafeEqual throws on differing lengths; the guard has to come first.
    expect(constantTimeEquals('123', '123456')).toBe(false)
  })
})

describe('buildOtpAuthUri', () => {
  it('produces a scannable URI', () => {
    const uri = buildOtpAuthUri({ secret: 'ABCDEF', accountName: 'admin@example.com' })
    expect(uri).toContain('otpauth://totp/')
    expect(uri).toContain('secret=ABCDEF')
    expect(uri).toContain('digits=6')
    expect(uri).toContain('period=30')
  })

  it('encodes the label so an email cannot break the URI', () => {
    const uri = buildOtpAuthUri({ secret: 'A', accountName: 'a+b@example.com' })
    expect(uri).toContain('%3A')
    expect(uri).not.toMatch(/totp\/[^?]*[:+]/)
  })
})

describe('recovery codes', () => {
  it('generates the requested number of distinct codes', () => {
    const codes = generateRecoveryCodes(10)
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
  })

  it('formats them legibly for writing down', () => {
    for (const code of generateRecoveryCodes(5)) {
      expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/)
    }
  })

  it('normalizes however the user types them back', () => {
    expect(normalizeRecoveryCode('a1b2c-d3e4f')).toBe('A1B2CD3E4F')
    expect(normalizeRecoveryCode('A1B2CD3E4F')).toBe('A1B2CD3E4F')
    expect(normalizeRecoveryCode(' a1b2c d3e4f ')).toBe('A1B2CD3E4F')
  })
})
