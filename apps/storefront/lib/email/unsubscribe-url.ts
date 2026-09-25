import { createHmac } from 'crypto'
import { SITE_URL } from '@/lib/site-url'

/**
 * Shared builders for the outbound unsubscribe link.
 *
 * Every transactional footer and the `List-Unsubscribe` header point at the standalone
 * `/unsubscribe` flow (`app/(public)/unsubscribe`), which writes `UnsubscribePreference` so
 * future sends exclude the address. The header and the footer must resolve to the same host,
 * so both read the base URL from here rather than each computing their own.
 */

/** Base URL for links in outbound email. Shared by the List-Unsubscribe header and email footers. */
export function getEmailBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || SITE_URL
}

/**
 * Signed token proving the recipient owns the address. `/unsubscribe` requires it before
 * returning stored preferences, so the page loads the recipient's current opt-outs instead of
 * blank defaults — without it, saving the form would overwrite prior category unsubscribes.
 */
export function generateUnsubscribeToken(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret'
  return createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex').slice(0, 32)
}

/** Verify a signed unsubscribe token for an email. */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  return generateUnsubscribeToken(email) === token
}

/**
 * Build the footer unsubscribe URL for a recipient: the working `/unsubscribe` flow, tokenized
 * so it loads the recipient's real preferences rather than the non-existent `/account/preferences`.
 */
export function buildUnsubscribeUrl(email: string): string {
  const token = generateUnsubscribeToken(email)
  return `${getEmailBaseUrl()}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`
}
