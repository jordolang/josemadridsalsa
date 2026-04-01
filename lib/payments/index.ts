/**
 * Payment Module Entry Point - Auto-registers adapters and exports the public API
 * Jose Madrid Salsa E-commerce Platform
 *
 * Imports all provider adapters and registers them based on available
 * environment variables. Consumers should import from this module
 * rather than from individual provider files.
 *
 * @module lib/payments
 *
 * @example
 * ```typescript
 * import { getProvider, getProviderForMethod } from '@/lib/payments'
 *
 * // Get adapter by provider name
 * const stripe = getProvider('STRIPE')
 *
 * // Get adapter by payment method (auto-routes via METHOD_PROVIDER_MAP)
 * const adapter = getProviderForMethod('PAYPAL')
 * ```
 */

import { registerProvider, getProvider, getProviderForMethod, getRegisteredProviders } from './registry'
import { StripeAdapter } from './providers/stripe'
import { PayPalAdapter } from './providers/paypal'
import { SquareAdapter } from './providers/square'

// Auto-register Stripe (always available)
registerProvider(new StripeAdapter())

// Register PayPal if credentials are configured
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  registerProvider(new PayPalAdapter())
}

// Register Square if access token is configured
if (process.env.SQUARE_ACCESS_TOKEN) {
  registerProvider(new SquareAdapter())
}

export { getProvider, getProviderForMethod, getRegisteredProviders, registerProvider }
export type { PaymentProviderAdapter, CreatePaymentRequest, PaymentResult, RefundRequest, RefundResult, WebhookVerificationRequest } from './types'
