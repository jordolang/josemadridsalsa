/**
 * Square checkout hook (P2 priority).
 *
 * Square payments use a two-step flow:
 * 1. Create order on backend → get orderId
 * 2. Tokenize card on client → send sourceId to backend → process payment
 *
 * Apple Pay via Square: The Square Web Payments SDK generates a nonce (sourceId)
 * from Apple Pay, which can be passed to the existing /api/checkout/square/process-payment
 * endpoint. This requires the Square Mobile Payments SDK (@square/mobile-payments-sdk)
 * which is separate from the React Native Stripe SDK.
 *
 * NOTE: This hook provides the API integration layer. The actual Square SDK
 * initialization and card tokenization UI must be added when Square Mobile
 * Payments SDK is integrated into the Expo build.
 */

import { useState, useCallback } from 'react';
import { api, ApiError } from '../lib/api';
import type { CheckoutRequest } from '../lib/api/types';

interface SquareCheckoutState {
  loading: boolean;
  error: string | null;
  completedOrderId: string | null;
  completedOrderNumber: string | null;
}

interface SquareCheckoutActions {
  /**
   * Create a Square order on the backend, then process payment with a
   * tokenized card sourceId from the Square Mobile Payments SDK.
   */
  processSquarePayment: (
    request: CheckoutRequest,
    sourceId: string,
    verificationToken?: string
  ) => Promise<boolean>;

  reset: () => void;
}

export function useSquareCheckout(): SquareCheckoutState & SquareCheckoutActions {
  const [state, setState] = useState<SquareCheckoutState>({
    loading: false,
    error: null,
    completedOrderId: null,
    completedOrderNumber: null,
  });

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      completedOrderId: null,
      completedOrderNumber: null,
    });
  }, []);

  const processSquarePayment = useCallback(
    async (
      request: CheckoutRequest,
      sourceId: string,
      verificationToken?: string
    ): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // Step 1: Create order on backend
        const orderResult = await api.checkout.createSquareOrder(request);

        // Step 2: Process payment with the tokenized card
        const paymentResult = await api.checkout.processSquarePayment({
          sourceId,
          orderId: orderResult.orderId,
          verificationToken,
          guestEmail: request.customer.email,
        });

        if (!paymentResult.success) {
          throw new Error('Square payment was not completed.');
        }

        setState({
          loading: false,
          error: null,
          completedOrderId: paymentResult.orderId,
          completedOrderNumber: paymentResult.orderNumber,
        });

        return true;
      } catch (error: unknown) {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Square payment failed. Please try again.';

        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));

        return false;
      }
    },
    []
  );

  return {
    ...state,
    processSquarePayment,
    reset,
  };
}
