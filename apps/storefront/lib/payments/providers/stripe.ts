/**
 * Stripe Payment Adapter - Handles card, Apple Pay, Google Pay, and ACH payments
 * Jose Madrid Salsa E-commerce Platform
 *
 * Implements PaymentProviderAdapter using the Stripe PaymentIntents API.
 * @module lib/payments/providers/stripe
 */

import { getStripe } from '@/lib/stripe'
import type {
  PaymentProviderAdapter,
  PaymentProvider,
  CreatePaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  CustomerResult,
  SavedPaymentMethod,
  PaymentMethodType,
  WebhookVerificationRequest,
} from '../types'

/**
 * Maps a Stripe PaymentIntent status string to the unified PaymentResult status.
 *
 * @param status - Stripe PaymentIntent status (e.g., 'succeeded', 'requires_action')
 * @returns Normalized payment status
 */
function mapStripeStatus(
  status: string
): PaymentResult['status'] {
  switch (status) {
    case 'requires_payment_method':
    case 'requires_confirmation':
      return 'REQUIRES_CONFIRMATION'
    case 'requires_action':
      return 'REQUIRES_ACTION'
    case 'processing':
      return 'PROCESSING'
    case 'succeeded':
      return 'SUCCEEDED'
    default:
      return 'FAILED'
  }
}

/**
 * Maps a Stripe card brand string to the unified PaymentMethodType.
 *
 * @param brand - Stripe card brand (e.g., 'visa', 'apple_pay')
 * @returns Normalized payment method type
 */
function mapStripeCardBrand(brand: string | undefined): PaymentMethodType {
  if (!brand) return 'CARD'
  switch (brand) {
    case 'apple_pay':
      return 'APPLE_PAY'
    case 'google_pay':
      return 'GOOGLE_PAY'
    default:
      return 'CARD'
  }
}

/**
 * Stripe payment provider adapter. Handles card payments, Apple Pay, Google Pay,
 * and ACH transfers via the Stripe PaymentIntents API.
 */
export class StripeAdapter implements PaymentProviderAdapter {
  readonly provider: PaymentProvider = 'STRIPE'

  /**
   * Creates a Stripe PaymentIntent for the given order.
   * Attaches shipping address and customer ID when available.
   * Enables `setup_future_usage` if a customer ID is provided with `setupFutureUsage`.
   *
   * @param request - Payment details including amount in cents, order metadata, and shipping
   * @returns Payment result with `clientSecret` for client-side confirmation
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
    const stripe = getStripe()

    const params: Parameters<typeof stripe.paymentIntents.create>[0] = {
      amount: request.amount,
      currency: request.currency,
      receipt_email: request.customerEmail,
      metadata: {
        orderId: request.orderId,
        orderNumber: request.orderNumber,
        customerName: request.customerName,
        ...request.metadata,
      },
    }

    if (request.shippingAddress) {
      params.shipping = {
        name: request.customerName,
        address: {
          line1: request.shippingAddress.line1,
          line2: request.shippingAddress.line2 ?? undefined,
          city: request.shippingAddress.city,
          state: request.shippingAddress.state,
          postal_code: request.shippingAddress.postalCode,
          country: request.shippingAddress.country,
        },
        phone: request.customerPhone ?? undefined,
      }
    }

    if (request.customerId) {
      params.customer = request.customerId
      if (request.setupFutureUsage) {
        params.setup_future_usage = 'on_session'
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(params)

    return {
      success: true,
      provider: 'STRIPE',
      providerPaymentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ?? undefined,
      status: mapStripeStatus(paymentIntent.status),
    }
  }

  /**
   * Retrieves the current status of a Stripe PaymentIntent.
   *
   * @param providerPaymentId - Stripe PaymentIntent ID (pi_xxx)
   * @returns Current payment status
   */
  async confirmPayment(providerPaymentId: string): Promise<PaymentResult> {
    const stripe = getStripe()
    const paymentIntent = await stripe.paymentIntents.retrieve(providerPaymentId)

    return {
      success: paymentIntent.status === 'succeeded',
      provider: 'STRIPE',
      providerPaymentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ?? undefined,
      status: mapStripeStatus(paymentIntent.status),
    }
  }

  /**
   * Processes a full or partial refund via the Stripe Refunds API.
   * Supports Stripe-specific reason codes: 'duplicate', 'fraudulent', 'requested_by_customer'.
   *
   * @param request - Refund details with PaymentIntent ID and optional amount in cents
   * @returns Refund result with status
   */
  async refund(request: RefundRequest): Promise<RefundResult> {
    const stripe = getStripe()

    const stripeRefund = await stripe.refunds.create({
      payment_intent: request.providerPaymentId,
      ...(request.amount ? { amount: request.amount } : {}),
      ...(request.reason
        ? { reason: request.reason as 'duplicate' | 'fraudulent' | 'requested_by_customer' }
        : {}),
    })

    return {
      success: stripeRefund.status === 'succeeded',
      provider: 'STRIPE',
      providerRefundId: stripeRefund.id,
      amount: stripeRefund.amount,
      status: stripeRefund.status === 'succeeded' ? 'SUCCEEDED' : 'PENDING',
    }
  }

  /**
   * Creates a Stripe Customer for saving payment methods across sessions.
   *
   * @param email - Customer email
   * @param name - Customer name
   * @param metadata - Optional metadata (e.g., userId)
   * @returns Stripe customer ID (cus_xxx)
   */
  async createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, string>
  ): Promise<CustomerResult> {
    const stripe = getStripe()

    const customer = await stripe.customers.create({
      email,
      name,
      metadata,
    })

    return {
      providerId: customer.id,
      provider: 'STRIPE',
    }
  }

  /**
   * Lists saved card payment methods for a Stripe customer.
   *
   * @param customerId - Stripe customer ID (cus_xxx)
   * @returns Array of saved cards with brand, last4, and expiration
   */
  async listPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]> {
    const stripe = getStripe()

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    })

    return paymentMethods.data.map((pm) => ({
      id: pm.id,
      provider: 'STRIPE' as const,
      type: mapStripeCardBrand(pm.card?.brand),
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
    }))
  }

  /**
   * Detaches a saved payment method from a Stripe customer.
   *
   * @param paymentMethodId - Stripe payment method ID (pm_xxx)
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    const stripe = getStripe()
    await stripe.paymentMethods.detach(paymentMethodId)
  }

  /**
   * Verifies a Stripe webhook signature using the STRIPE_WEBHOOK_SECRET.
   *
   * @param request - Raw webhook body and headers
   * @returns Whether the signature is valid
   */
  async verifyWebhookSignature(request: WebhookVerificationRequest): Promise<boolean> {
    const stripe = getStripe()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is not set')
      return false
    }

    const signature = request.headers.get('stripe-signature')
    if (!signature) return false

    try {
      stripe.webhooks.constructEvent(request.body, signature, webhookSecret)
      return true
    } catch {
      return false
    }
  }
}
