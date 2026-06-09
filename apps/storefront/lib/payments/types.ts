/**
 * Payment Provider Types - Provider-agnostic payment type definitions
 * Jose Madrid Salsa E-commerce Platform
 *
 * Shared types and interfaces used by all payment provider adapters.
 * @module lib/payments/types
 */

/** Supported payment processor identifiers. */
export type PaymentProvider = 'STRIPE' | 'SQUARE' | 'PAYPAL'

/** Payment method types that map to specific providers via the registry. */
export type PaymentMethodType =
  | 'CARD'
  | 'ACH'
  | 'APPLE_PAY'
  | 'GOOGLE_PAY'
  | 'PAYPAL'
  | 'SQUARE_TERMINAL'

/** Channel through which the payment is collected. */
export type PaymentChannel = 'ONLINE' | 'POS'

/** Normalized shipping or billing address shared across all providers. */
export interface PaymentAddress {
  /** Street address line 1 */
  line1: string
  /** Street address line 2 (apartment, suite, etc.) */
  line2?: string
  /** City name */
  city: string
  /** State or province code */
  state: string
  /** Postal / ZIP code */
  postalCode: string
  /** ISO 3166-1 alpha-2 country code */
  country: string
}

/** Provider-agnostic request to initiate a payment. */
export interface CreatePaymentRequest {
  /** Amount in cents (e.g., 4299 = $42.99) */
  amount: number
  /** ISO 4217 currency code (e.g., 'usd') */
  currency: string
  /** Internal order ID (CUID) */
  orderId: string
  /** Human-readable order number (e.g., JMS-20260331-1234) */
  orderNumber: string
  /** Customer email for receipts */
  customerEmail: string
  /** Customer display name */
  customerName: string
  /** Customer phone number */
  customerPhone?: string
  /** Shipping address for the order */
  shippingAddress?: PaymentAddress
  /** Payment method type, used for provider routing */
  methodType?: PaymentMethodType
  /** Payment channel (online checkout vs. point-of-sale) */
  channel?: PaymentChannel
  /** Provider-specific customer ID (e.g., Stripe cus_xxx) */
  customerId?: string
  /** Whether to save the payment method for future use */
  setupFutureUsage?: boolean
  /** Arbitrary key-value metadata passed to the provider */
  metadata?: Record<string, string>
}

/** Result returned after creating or confirming a payment. */
export interface PaymentResult {
  /** Whether the operation completed without error */
  success: boolean
  /** Which provider processed the payment */
  provider: PaymentProvider
  /** Provider-specific payment identifier */
  providerPaymentId: string
  /** Client secret for client-side confirmation (Stripe) */
  clientSecret?: string
  /** Approval URL for redirect-based flows (PayPal) */
  approvalUrl?: string
  /** Current payment status */
  status: 'REQUIRES_ACTION' | 'REQUIRES_CONFIRMATION' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'
  /** Error message if the operation failed */
  error?: string
}

/** Request to refund a previously captured payment. */
export interface RefundRequest {
  /** Provider-specific payment ID to refund */
  providerPaymentId: string
  /** Refund amount in cents; omit for full refund */
  amount?: number
  /** Reason for the refund (provider-specific values may apply) */
  reason?: string
}

/** Result returned after processing a refund. */
export interface RefundResult {
  /** Whether the refund was initiated successfully */
  success: boolean
  /** Which provider processed the refund */
  provider: PaymentProvider
  /** Provider-specific refund identifier */
  providerRefundId: string
  /** Refunded amount in cents */
  amount: number
  /** Current refund status */
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED'
  /** Error message if the refund failed */
  error?: string
}

/** Result returned after creating a customer with a provider. */
export interface CustomerResult {
  /** Provider-specific customer identifier */
  providerId: string
  /** Which provider the customer was created with */
  provider: PaymentProvider
}

/** A payment method saved on file with a provider. */
export interface SavedPaymentMethod {
  /** Provider-specific payment method identifier */
  id: string
  /** Which provider stores this method */
  provider: PaymentProvider
  /** Payment method type */
  type: PaymentMethodType
  /** Card brand (e.g., 'visa', 'mastercard') */
  brand?: string
  /** Last four digits of the card or account */
  last4?: string
  /** Card expiration month (1-12) */
  expMonth?: number
  /** Card expiration year (4-digit) */
  expYear?: number
}

/** Raw webhook request data for provider signature verification. */
export interface WebhookVerificationRequest {
  /** Raw request body as a string */
  body: string
  /** Request headers containing the provider's signature */
  headers: Headers
}

/**
 * Common interface that all payment provider adapters must implement.
 * Each provider (Stripe, PayPal, Square) provides a concrete implementation
 * that translates these operations into provider-specific API calls.
 */
export interface PaymentProviderAdapter {
  /** The provider this adapter handles. */
  readonly provider: PaymentProvider

  /**
   * Initiates a payment with the provider.
   *
   * @param request - Payment details including amount, currency, and order info
   * @returns Payment result with provider-specific data (client secret or approval URL)
   */
  createPayment(request: CreatePaymentRequest): Promise<PaymentResult>

  /**
   * Confirms or retrieves the status of a previously created payment.
   *
   * @param providerPaymentId - Provider-specific payment identifier
   * @returns Current payment status
   */
  confirmPayment(providerPaymentId: string): Promise<PaymentResult>

  /**
   * Processes a full or partial refund on a captured payment.
   *
   * @param request - Refund details including the payment ID and optional amount
   * @returns Refund result with status
   */
  refund(request: RefundRequest): Promise<RefundResult>

  /**
   * Creates a customer record with the provider for saved payment methods.
   *
   * @param email - Customer email address
   * @param name - Customer display name
   * @param metadata - Optional key-value metadata
   * @returns Provider-specific customer identifier
   */
  createCustomer(email: string, name: string, metadata?: Record<string, string>): Promise<CustomerResult>

  /**
   * Lists saved payment methods for a customer.
   *
   * @param customerId - Provider-specific customer identifier
   * @returns Array of saved payment methods
   */
  listPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]>

  /**
   * Removes a saved payment method from the provider.
   *
   * @param paymentMethodId - Provider-specific payment method identifier
   */
  detachPaymentMethod(paymentMethodId: string): Promise<void>

  /**
   * Verifies a webhook signature from the provider.
   *
   * @param request - Raw webhook body and headers for signature verification
   * @returns Whether the signature is valid
   */
  verifyWebhookSignature(request: WebhookVerificationRequest): Promise<boolean>
}
