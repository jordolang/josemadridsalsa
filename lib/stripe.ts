import Stripe from 'stripe'

/** Stripe secret key resolved from server-only environment variables */
const secretKey =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET ||
  process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY

/** Cached singleton Stripe client instance */
let stripeClient: Stripe | null = null

/**
 * Get or create the singleton Stripe client instance.
 *
 * Lazily initializes a Stripe SDK client with retry and timeout configuration.
 * Subsequent calls return the cached instance.
 *
 * @returns The configured Stripe client
 * @throws {Error} If no Stripe secret key is configured in environment variables
 */
export const getStripe = () => {
  if (!secretKey) {
    throw new Error(
      'Stripe secret key is not configured. Please set STRIPE_SECRET_KEY in your environment.'
    )
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-10-29.clover',
      maxNetworkRetries: 2,
      timeout: 30000, // 30 seconds
    })
  }

  return stripeClient
}
