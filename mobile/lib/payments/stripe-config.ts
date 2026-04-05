/**
 * Stripe configuration for the mobile app.
 *
 * The publishable key is safe to embed in client code -- it only identifies
 * the Stripe account and cannot perform privileged operations.
 * The secret key stays on the backend.
 */

import { Platform } from 'react-native';

/**
 * Stripe publishable key. In production, this should come from
 * app config / environment variables via expo-constants.
 */
export const STRIPE_PUBLISHABLE_KEY = __DEV__
  ? 'pk_test_placeholder' // Replace with actual test key
  : 'pk_live_placeholder'; // Replace with actual live key

/**
 * Apple Pay merchant identifier.
 * Must match the merchant ID registered in Apple Developer Portal
 * and verified in the Stripe Dashboard.
 */
export const APPLE_PAY_MERCHANT_ID = 'merchant.com.josemadridsalsa';

/**
 * Country code for Apple Pay (merchant's country).
 */
export const MERCHANT_COUNTRY_CODE = 'US';

/**
 * Currency code for Apple Pay.
 */
export const CURRENCY_CODE = 'USD';

/**
 * Display name shown on the Apple Pay sheet.
 */
export const MERCHANT_DISPLAY_NAME = 'José Madrid Salsa';

/**
 * Whether Apple Pay is supported on this platform.
 * Apple Pay is only available on iOS physical devices (not simulators).
 */
export const IS_APPLE_PAY_PLATFORM = Platform.OS === 'ios';
