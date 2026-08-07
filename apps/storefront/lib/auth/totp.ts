import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Time-based one-time passwords (RFC 6238) for admin sign-in.
 *
 * Implemented directly rather than pulled in as a dependency: TOTP is HMAC over a time
 * counter plus dynamic truncation, it is fully specified, and the RFC publishes official
 * test vectors — so this is verified against the spec itself in
 * `tests/lib/auth/totp.test.ts` rather than trusted on reputation.
 *
 * Interoperates with Google Authenticator, 1Password, Authy and friends: SHA-1, 6 digits,
 * 30-second period, base32-encoded secret.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export const TOTP_DIGITS = 6
export const TOTP_PERIOD_SECONDS = 30
/**
 * How many periods either side of "now" are accepted. One step covers ordinary clock skew
 * and a user typing the last digit as the code rolls; widening it materially weakens the
 * factor, so it stays at one.
 */
export const TOTP_WINDOW = 1

export function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

export function base32Decode(input: string): Buffer {
  // Authenticator apps display secrets in spaced, lower-cased groups; padding is optional.
  const normalized = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')

  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) throw new Error('Invalid base32 character in secret')

    value = (value << 5) | index
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

/** A fresh 160-bit secret, the size RFC 4226 recommends for HMAC-SHA1. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

/**
 * HOTP (RFC 4226): HMAC of the counter, then dynamic truncation to `digits`.
 */
export function generateHotp(
  secret: string,
  counter: number,
  digits: number = TOTP_DIGITS,
  algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha1'
): string {
  const key = base32Decode(secret)

  // 8-byte big-endian counter. Written as two 32-bit halves because the counter can exceed
  // what a 32-bit write handles once times run past 2038.
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  counterBuffer.writeUInt32BE(counter >>> 0, 4)

  const digest = createHmac(algorithm, key).update(counterBuffer).digest()

  // Dynamic truncation: the low nibble of the last byte picks the offset.
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  return (binary % 10 ** digits).toString().padStart(digits, '0')
}

export function counterForTime(atMs: number, period: number = TOTP_PERIOD_SECONDS): number {
  return Math.floor(atMs / 1000 / period)
}

export function generateTotp(
  secret: string,
  atMs: number = Date.now(),
  options: { digits?: number; period?: number; algorithm?: 'sha1' | 'sha256' | 'sha512' } = {}
): string {
  const { digits = TOTP_DIGITS, period = TOTP_PERIOD_SECONDS, algorithm = 'sha1' } = options
  return generateHotp(secret, counterForTime(atMs, period), digits, algorithm)
}

/**
 * Check a submitted code against the accepted window.
 *
 * Comparison is constant-time: a timing side channel on code comparison is a real way to
 * narrow a six-digit space.
 */
export function verifyTotp(
  secret: string,
  token: string,
  atMs: number = Date.now(),
  options: { window?: number; digits?: number; period?: number } = {}
): boolean {
  const { window = TOTP_WINDOW, digits = TOTP_DIGITS, period = TOTP_PERIOD_SECONDS } = options

  const cleaned = token.replace(/\s+/g, '')
  if (!new RegExp(`^\\d{${digits}}$`).test(cleaned)) return false

  const counter = counterForTime(atMs, period)

  let matched = false
  for (let drift = -window; drift <= window; drift++) {
    const candidate = generateHotp(secret, counter + drift, digits)
    // Every candidate is compared rather than returning on first match, so the time taken
    // does not reveal which step matched.
    if (constantTimeEquals(candidate, cleaned)) matched = true
  }

  return matched
}

export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * The `otpauth://` URI an authenticator app scans.
 * Label and issuer are encoded because account emails routinely contain characters that
 * would otherwise break the URI.
 */
export function buildOtpAuthUri(options: {
  secret: string
  accountName: string
  issuer?: string
}): string {
  const { secret, accountName, issuer = 'Jose Madrid Salsa' } = options
  const label = encodeURIComponent(`${issuer}:${accountName}`)

  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  })

  return `otpauth://totp/${label}?${params.toString()}`
}

export const RECOVERY_CODE_COUNT = 10

/**
 * Single-use codes for when the authenticator device is lost. Grouped for legibility, since
 * these get written down.
 */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString('hex').toUpperCase()
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`
  })
}

/** Normalized so a code typed without its dash, or in lower case, still matches. */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
