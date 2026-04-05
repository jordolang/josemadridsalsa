/**
 * Checkout hook that orchestrates the full payment flow:
 *
 * 1. Create checkout session on backend (returns Stripe clientSecret)
 * 2. Present Stripe PaymentSheet (card or Apple Pay)
 * 3. Handle payment result
 * 4. Return order confirmation data
 *
 * Supports:
 * - Standard card payments via PaymentSheet
 * - Apple Pay via PaymentSheet (automatic when available)
 * - Guest checkout (no session required)
 */

import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import {
  useStripe,
  isPlatformPaySupported,
} from '@stripe/stripe-react-native';
import { api, ApiError } from '../lib/api';
import type { CheckoutRequest, CheckoutResponse } from '../lib/api/types';
import {
  MERCHANT_COUNTRY_CODE,
  CURRENCY_CODE,
  MERCHANT_DISPLAY_NAME,
  IS_APPLE_PAY_PLATFORM,
} from '../lib/payments';

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentMethod = 'card' | 'apple_pay';

interface CheckoutState {
  /** Whether a checkout operation is in progress */
  loading: boolean;
  /** Error message from the last failed attempt */
  error: string | null;
  /** The completed order ID after successful payment */
  completedOrderId: string | null;
  /** The completed order number for display */
  completedOrderNumber: string | null;
}

interface CheckoutActions {
  /**
   * Start the standard checkout flow with Stripe PaymentSheet.
   * The PaymentSheet automatically offers Apple Pay when available.
   */
  startCheckout: (request: CheckoutRequest) => Promise<boolean>;

  /**
   * Start the Apple Pay checkout flow directly.
   * Falls back to standard checkout if Apple Pay is unavailable.
   */
  startApplePayCheckout: (request: CheckoutRequest) => Promise<boolean>;

  /** Whether Apple Pay is available on this device */
  isApplePayAvailable: boolean;

  /** Reset the checkout state for a new attempt */
  reset: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useCheckout(): CheckoutState & CheckoutActions {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [state, setState] = useState<CheckoutState>({
    loading: false,
    error: null,
    completedOrderId: null,
    completedOrderNumber: null,
  });

  const [platformPaySupported, setPlatformPaySupported] = useState(false);

  useEffect(() => {
    if (IS_APPLE_PAY_PLATFORM) {
      isPlatformPaySupported().then(setPlatformPaySupported);
    }
  }, []);

  const isApplePayAvailable = IS_APPLE_PAY_PLATFORM && platformPaySupported;

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      completedOrderId: null,
      completedOrderNumber: null,
    });
  }, []);

  /**
   * Create a checkout session on the backend.
   * Returns the Stripe clientSecret and order metadata.
   */
  const createCheckoutSession = useCallback(
    async (request: CheckoutRequest): Promise<CheckoutResponse> => {
      try {
        return await api.checkout.createCheckout(request);
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          throw new Error(
            error.fieldErrors
              ? Object.values(error.fieldErrors).flat().join('. ')
              : error.message
          );
        }
        throw error;
      }
    },
    []
  );

  /**
   * Standard checkout flow using Stripe PaymentSheet.
   * PaymentSheet automatically includes Apple Pay when available.
   */
  const startCheckout = useCallback(
    async (request: CheckoutRequest): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Step 1: Create checkout session on backend
        const session = await createCheckoutSession(request);

        // Step 2: Initialize PaymentSheet
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: session.clientSecret,
          merchantDisplayName: MERCHANT_DISPLAY_NAME,
          applePay: isApplePayAvailable
            ? {
                merchantCountryCode: MERCHANT_COUNTRY_CODE,
              }
            : undefined,
          defaultBillingDetails: {
            email: request.customer.email,
            name: `${request.customer.firstName} ${request.customer.lastName}`,
            phone: request.customer.phone,
          },
          returnURL: 'josemadridsalsa://checkout-complete',
        });

        if (initError) {
          throw new Error(initError.message);
        }

        // Step 3: Present PaymentSheet to user
        const { error: presentError } = await presentPaymentSheet();

        if (presentError) {
          // User cancelled -- not an error
          if (presentError.code === 'Canceled') {
            setState((prev) => ({ ...prev, loading: false }));
            return false;
          }
          throw new Error(presentError.message);
        }

        // Step 4: Payment succeeded
        setState({
          loading: false,
          error: null,
          completedOrderId: session.orderId,
          completedOrderNumber: null, // Order number comes from order detail fetch
        });

        return true;
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Payment failed. Please try again.';

        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));

        return false;
      }
    },
    [createCheckoutSession, initPaymentSheet, presentPaymentSheet, isApplePayAvailable]
  );

  /**
   * Apple Pay direct checkout flow.
   * Uses the Stripe Apple Pay integration which handles the Apple Pay sheet
   * and confirms the PaymentIntent in one step.
   */
  const startApplePayCheckout = useCallback(
    async (request: CheckoutRequest): Promise<boolean> => {
      if (!isApplePayAvailable) {
        // Fall back to standard PaymentSheet which shows card entry
        return startCheckout(request);
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Create checkout session on backend
        const session = await createCheckoutSession(request);

        // Initialize PaymentSheet with Apple Pay forced
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: session.clientSecret,
          merchantDisplayName: MERCHANT_DISPLAY_NAME,
          applePay: {
            merchantCountryCode: MERCHANT_COUNTRY_CODE,
          },
          returnURL: 'josemadridsalsa://checkout-complete',
        });

        if (initError) {
          throw new Error(initError.message);
        }

        // Present PaymentSheet (will show Apple Pay as primary option)
        const { error: presentError } = await presentPaymentSheet();

        if (presentError) {
          if (presentError.code === 'Canceled') {
            setState((prev) => ({ ...prev, loading: false }));
            return false;
          }
          throw new Error(presentError.message);
        }

        setState({
          loading: false,
          error: null,
          completedOrderId: session.orderId,
          completedOrderNumber: null,
        });

        return true;
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Apple Pay failed. Please try again.';

        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));

        return false;
      }
    },
    [
      isApplePayAvailable,
      startCheckout,
      createCheckoutSession,
      initPaymentSheet,
      presentPaymentSheet,
    ]
  );

  return {
    ...state,
    startCheckout,
    startApplePayCheckout,
    isApplePayAvailable,
    reset,
  };
}
