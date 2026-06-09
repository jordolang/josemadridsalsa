/**
 * Stripe configuration for the mobile app.
 *
 * The publishable key is safe to embed in client code -- it only identifies
 * the Stripe account and cannot perform privileged operations.
 * The secret key stays on the backend.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Stripe publishable key loaded from app.config.ts extra fields.
 *
 * Set via the STRIPE_PUBLISHABLE_KEY environment variable before
 * starting the dev server or building the app. See .env.example.
 *
 * Falls back to an empty string if the key is not set.
 */
const configKey = Constants.expoConfig?.extra?.stripePublishableKey as
  | string
  | undefined;

export const STRIPE_PUBLISHABLE_KEY = configKey || '';

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
