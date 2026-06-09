/**
 * Checkout endpoints for Stripe, Square, and PayPal payment flows.
 * Checkout supports both authenticated and guest users.
 */

import { post, authPost } from './client';
import type {
  CheckoutRequest,
  CheckoutResponse,
  CheckoutShipping,
  CalculateShippingResponse,
  CalculateTaxResponse,
  ValidateDiscountResponse,
  SquareProcessPaymentRequest,
  SquareProcessPaymentResponse,
  PayPalCreateOrderResponse,
  PayPalCaptureOrderRequest,
} from './types';

// ─── Stripe (Primary) ───────────────────────────────────────────────────────

/**
 * Initiate Stripe checkout and create a PaymentIntent.
 *
 * Supports both authenticated users (session cookie) and guest checkout.
 *
 * @param data - Checkout details: items, customer info, shipping address, optional discount
 * @returns Object with `clientSecret` for Stripe confirmation, `orderId`, and `amount` in cents
 * @throws {ApiError} With status 422 on validation errors (out of stock, invalid discount, etc.)
 *
 * @example
 * ```ts
 * const { clientSecret } = await createCheckout({
 *   items: [{ productId: 'abc', quantity: 2 }],
 *   customer: { email: 'user@example.com', firstName: 'Jane', lastName: 'Doe' },
 *   shipping: { address1: '123 Main St', city: 'Columbus', state: 'OH', postalCode: '43215' },
 * });
 * ```
 */
export async function createCheckout(data: CheckoutRequest): Promise<CheckoutResponse> {
  return post<CheckoutResponse>('/api/checkout', data);
}

/**
 * Retry a failed payment for an existing order.
 *
 * @param orderId - The ID of the order with the failed payment
 * @returns New `clientSecret` for retrying the Stripe PaymentIntent
 * @throws {ApiError} With status 404 if order not found, 400 if already paid
 */
export async function retryPayment(orderId: string): Promise<CheckoutResponse> {
  return authPost<CheckoutResponse>('/api/checkout/retry-payment', { orderId });
}

// ─── Square ──────────────────────────────────────────────────────────────────

/**
 * Create a Square checkout order. Uses the same request shape as Stripe checkout.
 *
 * @param data - Checkout details (same shape as Stripe checkout)
 * @returns Object with the created `orderId`
 */
export async function createSquareOrder(data: CheckoutRequest): Promise<{ orderId: string }> {
  return post<{ orderId: string }>('/api/checkout/square/create-order', data);
}

/**
 * Process a Square payment with a tokenized card source.
 *
 * @param data - Source ID from Square SDK, order ID, and optional verification token
 * @returns Confirmation with order number and Square payment ID
 */
export async function processSquarePayment(
  data: SquareProcessPaymentRequest
): Promise<SquareProcessPaymentResponse> {
  return post<SquareProcessPaymentResponse>('/api/checkout/square/process-payment', data);
}

// ─── PayPal ──────────────────────────────────────────────────────────────────

/**
 * Create a PayPal order. Returns an approval URL for redirect-based flow.
 *
 * @param data - Checkout details (same shape as Stripe checkout)
 * @returns PayPal order ID, approval URL for user redirect, and amount in cents
 */
export async function createPayPalOrder(
  data: CheckoutRequest
): Promise<PayPalCreateOrderResponse> {
  return post<PayPalCreateOrderResponse>('/api/checkout/paypal/create-order', data);
}

/**
 * Capture a PayPal order after user approval in the PayPal redirect flow.
 *
 * @param data - PayPal order ID and internal order ID to capture
 * @returns Capture confirmation
 */
export async function capturePayPalOrder(data: PayPalCaptureOrderRequest): Promise<unknown> {
  return post('/api/checkout/paypal/capture-order', data);
}

// ─── Shipping & Tax Calculation ──────────────────────────────────────────────

/**
 * Calculate shipping options and cost for a given address and items.
 *
 * @param data - Item weights/quantities, shipping address, and order subtotal
 * @returns Shipping cost, method, estimated delivery, and available options
 */
export async function calculateShipping(data: {
  items: Array<{ weight: number; quantity: number }>;
  shippingAddress: CheckoutShipping & { country?: string };
  subtotal: number;
}): Promise<CalculateShippingResponse> {
  return post<CalculateShippingResponse>('/api/checkout/calculate-shipping', data);
}

/**
 * Calculate tax for a given set of items and shipping address.
 *
 * @param data - Line items with amounts, shipping address, and customer email
 * @returns Tax amount, rate, and optional breakdown by jurisdiction
 */
export async function calculateTax(data: {
  lineItems: Array<{ amount: number; reference: string; taxCode?: string }>;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  customerEmail: string;
}): Promise<CalculateTaxResponse> {
  return post<CalculateTaxResponse>('/api/checkout/calculate-tax', data);
}

/**
 * Validate a discount code and return its type and value.
 *
 * @param code - The discount code to validate
 * @returns Validity status, discount type (percentage/fixed/free shipping), and value
 */
export async function validateDiscount(code: string): Promise<ValidateDiscountResponse> {
  return post<ValidateDiscountResponse>('/api/checkout/validate-discount', { code });
}

/**
 * Apply a gift certificate to the checkout.
 *
 * @param code - The gift certificate code
 * @returns The remaining balance on the gift certificate after application
 */
export async function applyGiftCertificate(code: string): Promise<{ balance: number }> {
  return post<{ balance: number }>('/api/checkout/apply-gift-certificate', { code });
}
