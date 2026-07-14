import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Grants a guest access to their own order.
 *
 * Guest orders have no userId, so the owner check on /api/orders/[orderId] can never
 * pass for them and every guest was shown an error page immediately after paying.
 * The order id alone cannot be the credential — it is the resource identifier, and
 * accepting it would let anyone who learns an id read that customer's name, email and
 * shipping address.
 *
 * Instead we hand the buyer a token derived from the order id and the app secret. It
 * is deterministic, so it can be minted when the order is created and reused for both
 * the post-payment redirect and Stripe's return_url (which comes back to us directly,
 * without passing through our client code). It carries no state and needs no schema
 * change, and it cannot be forged without the secret.
 */
function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET

  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set; cannot issue order access tokens.')
  }

  return secret
}

export function createOrderAccessToken(orderId: string): string {
  return createHmac('sha256', getSecret()).update(`order:${orderId}`).digest('hex')
}

export function verifyOrderAccessToken(orderId: string, token: string | null | undefined): boolean {
  if (!token) return false

  const expected = createOrderAccessToken(orderId)
  const provided = Buffer.from(token, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')

  // timingSafeEqual throws unless both buffers are the same length.
  if (provided.length !== expectedBuffer.length) return false

  return timingSafeEqual(provided, expectedBuffer)
}
