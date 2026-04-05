/**
 * Payment infrastructure barrel export.
 *
 * Re-exports the {@link StripeProvider} wrapper component and
 * Stripe configuration constants used across the mobile app.
 *
 * @module mobile/lib/payments
 */

export { StripeProvider } from './StripeProvider';
export {
  STRIPE_PUBLISHABLE_KEY,
  APPLE_PAY_MERCHANT_ID,
  MERCHANT_COUNTRY_CODE,
  CURRENCY_CODE,
  MERCHANT_DISPLAY_NAME,
  IS_APPLE_PAY_PLATFORM,
} from './stripe-config';
