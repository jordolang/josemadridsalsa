/**
 * PayPal Payment Adapter - Handles PayPal wallet and Venmo payments
 * Jose Madrid Salsa E-commerce Platform
 *
 * Implements PaymentProviderAdapter using the PayPal Orders API (create/capture)
 * and Payments API (refunds). Uses redirect/popup-based authorization flow.
 * @module lib/payments/providers/paypal
 */

import paypal from '@paypal/checkout-server-sdk'
import type {
  PaymentProviderAdapter,
  PaymentProvider,
  CreatePaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  CustomerResult,
  SavedPaymentMethod,
  WebhookVerificationRequest,
} from '../types'

/**
 * Reads PayPal configuration from environment variables.
 *
 * @returns PayPal config with client credentials, sandbox flag, and redirect URLs
 */
function getPayPalConfig() {
  return {
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    sandbox: process.env.PAYPAL_SANDBOX !== 'false',
    returnUrl: process.env.PAYPAL_RETURN_URL || `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/paypal/return`,
    cancelUrl: process.env.PAYPAL_CANCEL_URL || `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/paypal/cancel`,
  }
}

/** Lazily initialized singleton PayPal HTTP client. */
let paypalClient: paypal.core.PayPalHttpClient | null = null

/**
 * Returns the singleton PayPal HTTP client, creating it on first call.
 * Uses sandbox or live environment based on the PAYPAL_SANDBOX env var.
 *
 * @returns PayPal HTTP client instance
 * @throws {Error} If PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET are not set
 */
function getPayPalClient(): paypal.core.PayPalHttpClient {
  if (paypalClient) return paypalClient

  const config = getPayPalConfig()

  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      'PayPal credentials not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.'
    )
  }

  const environment = config.sandbox
    ? new paypal.core.SandboxEnvironment(config.clientId, config.clientSecret)
    : new paypal.core.LiveEnvironment(config.clientId, config.clientSecret)

  paypalClient = new paypal.core.PayPalHttpClient(environment)
  return paypalClient
}

/** Timeout for all PayPal API calls (15 seconds). */
const PAYPAL_API_TIMEOUT_MS = 15_000

/**
 * Cached PayPal OAuth2 access token.
 * PayPal tokens last ~9 hours; we refresh 5 minutes early to avoid expiry races.
 */
let cachedAccessToken: { token: string; expiresAt: number } | null = null

/**
 * Obtains a PayPal OAuth2 access token, using a cached value when available.
 * Saves ~200-500ms per webhook by avoiding redundant token fetches.
 *
 * @param baseUrl - PayPal API base URL (sandbox or live)
 * @param clientId - PayPal client ID
 * @param clientSecret - PayPal client secret
 * @returns Access token string, or null if the token request failed
 */
export async function getPayPalAccessToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string | null> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt) {
    return cachedAccessToken.token
  }

  const tokenResponse = await withTimeout(
    fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    }),
    PAYPAL_API_TIMEOUT_MS,
    'getAccessToken'
  )

  if (!tokenResponse.ok) {
    console.error('PayPal token fetch failed:', tokenResponse.status)
    cachedAccessToken = null
    return null
  }

  const tokenData = await tokenResponse.json()
  const expiresInMs = (tokenData.expires_in || 32400) * 1000
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + expiresInMs - 5 * 60 * 1000, // refresh 5 min early
  }

  return cachedAccessToken.token
}

/**
 * Wraps a promise with a timeout, rejecting if it doesn't resolve within the limit.
 *
 * @param promise - The promise to wrap
 * @param ms - Timeout in milliseconds
 * @param label - Label for the timeout error message
 * @returns The resolved value of the promise
 * @throws {Error} If the promise does not resolve within the timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`PayPal API timeout after ${ms}ms: ${label}`)), ms)
    ),
  ])
}

/**
 * PayPal payment provider adapter. Handles PayPal wallet and Venmo payments
 * via the PayPal Orders API (create/capture) and Payments API (refunds).
 * Uses redirect/popup-based authorization flow.
 */
export class PayPalAdapter implements PaymentProviderAdapter {
  readonly provider: PaymentProvider = 'PAYPAL'

  /**
   * Creates a PayPal Order with intent CAPTURE.
   * Converts amount from cents to dollars. Returns an approvalUrl
   * that the client uses to redirect the customer to PayPal for authorization.
   *
   * @param request - Payment details including amount in cents and order info
   * @returns Payment result with `approvalUrl` for customer redirect
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
    const client = getPayPalClient()
    const config = getPayPalConfig()

    const orderRequest = new paypal.orders.OrdersCreateRequest()
    orderRequest.prefer('return=representation')
    orderRequest.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: request.orderId,
          description: `Order ${request.orderNumber}`,
          custom_id: request.orderId,
          amount: {
            currency_code: request.currency.toUpperCase(),
            value: (request.amount / 100).toFixed(2),
          },
          ...(request.shippingAddress
            ? {
                shipping: {
                  name: { full_name: request.customerName },
                  address: {
                    address_line_1: request.shippingAddress.line1,
                    address_line_2: request.shippingAddress.line2 || undefined,
                    admin_area_2: request.shippingAddress.city,
                    admin_area_1: request.shippingAddress.state,
                    postal_code: request.shippingAddress.postalCode,
                    country_code: request.shippingAddress.country,
                  },
                },
              }
            : {}),
        },
      ],
      application_context: {
        return_url: config.returnUrl,
        cancel_url: config.cancelUrl,
        brand_name: 'Jose Madrid Salsa',
        user_action: 'PAY_NOW',
      },
    })

    const response = await withTimeout(client.execute(orderRequest), PAYPAL_API_TIMEOUT_MS, 'createOrder')
    const paypalOrderId = response.result.id

    // Find the approval URL for redirect
    const approvalLink = response.result.links?.find(
      (link: { rel: string; href: string }) => link.rel === 'approve'
    )

    return {
      success: true,
      provider: 'PAYPAL',
      providerPaymentId: paypalOrderId,
      approvalUrl: approvalLink?.href,
      status: 'REQUIRES_ACTION',
    }
  }

  /**
   * Confirms a PayPal payment by checking order status and capturing if approved.
   * If the order is already COMPLETED, returns success immediately.
   * If APPROVED, captures the payment. Otherwise returns FAILED.
   *
   * @param providerPaymentId - PayPal Order ID
   * @returns Current payment status after capture attempt
   */
  async confirmPayment(providerPaymentId: string): Promise<PaymentResult> {
    const client = getPayPalClient()

    // First check the order status
    const getRequest = new paypal.orders.OrdersGetRequest(providerPaymentId)
    const getResponse = await withTimeout(client.execute(getRequest), PAYPAL_API_TIMEOUT_MS, 'getOrder')

    if (getResponse.result.status === 'COMPLETED') {
      return {
        success: true,
        provider: 'PAYPAL',
        providerPaymentId,
        status: 'SUCCEEDED',
      }
    }

    if (getResponse.result.status !== 'APPROVED') {
      return {
        success: false,
        provider: 'PAYPAL',
        providerPaymentId,
        status: 'FAILED',
        error: `PayPal order status: ${getResponse.result.status}`,
      }
    }

    // Capture the approved payment
    const captureRequest = new paypal.orders.OrdersCaptureRequest(providerPaymentId)
    captureRequest.requestBody({})

    const captureResponse = await withTimeout(client.execute(captureRequest), PAYPAL_API_TIMEOUT_MS, 'captureOrder')

    const isCompleted = captureResponse.result.status === 'COMPLETED'

    return {
      success: isCompleted,
      provider: 'PAYPAL',
      providerPaymentId,
      status: isCompleted ? 'SUCCEEDED' : 'FAILED',
      error: isCompleted ? undefined : `Capture status: ${captureResponse.result.status}`,
    }
  }

  /**
   * Refunds a captured PayPal payment via the Captures Refund API.
   * Supports partial refunds by specifying an amount. The reason is
   * sent as `note_to_payer` visible to the customer.
   *
   * @param request - Refund details; providerPaymentId is the PayPal capture ID
   * @returns Refund result with status
   */
  async refund(request: RefundRequest): Promise<RefundResult> {
    const client = getPayPalClient()

    // The providerPaymentId for PayPal is the capture ID
    const refundRequest = new paypal.payments.CapturesRefundRequest(
      request.providerPaymentId
    )

    const body: Record<string, unknown> = {}
    if (request.amount) {
      body.amount = {
        currency_code: 'USD',
        value: (request.amount / 100).toFixed(2),
      }
    }
    if (request.reason) {
      body.note_to_payer = request.reason
    }

    refundRequest.requestBody(body)

    const response = await withTimeout(client.execute(refundRequest), PAYPAL_API_TIMEOUT_MS, 'refund')

    const isCompleted = response.result.status === 'COMPLETED'

    return {
      success: isCompleted,
      provider: 'PAYPAL',
      providerRefundId: response.result.id,
      amount: request.amount || 0,
      status: isCompleted ? 'SUCCEEDED' : 'PENDING',
      error: isCompleted ? undefined : `Refund status: ${response.result.status}`,
    }
  }

  /**
   * No-op: PayPal identifies customers via their PayPal account during checkout.
   * The payer ID is captured during order completion rather than pre-created.
   */
  async createCustomer(
    _email: string,
    _name: string,
    _metadata?: Record<string, string>
  ): Promise<CustomerResult> {
    // PayPal doesn't have a traditional customer object like Stripe.
    // Customer identity is handled via PayPal account during checkout.
    // Return a placeholder -- the PayPal payer ID is captured during order completion.
    return {
      providerId: '',
      provider: 'PAYPAL',
    }
  }

  /** No-op: PayPal Vault API integration is not yet implemented. */
  async listPaymentMethods(_customerId: string): Promise<SavedPaymentMethod[]> {
    // PayPal vaulting requires PayPal Vault API (separate integration).
    // For now, return empty -- PayPal payments use redirect flow.
    return []
  }

  /** No-op: PayPal Vault API integration is not yet implemented. */
  async detachPaymentMethod(_paymentMethodId: string): Promise<void> {
    // No-op for PayPal -- see listPaymentMethods note above.
  }

  /**
   * Verifies a PayPal webhook signature using PayPal's Webhook Verification API.
   * Extracts PayPal signature headers, validates the cert URL against a PayPal
   * domain allowlist (SSRF protection), obtains an access token, and calls
   * the /v1/notifications/verify-webhook-signature endpoint.
   *
   * @param request - Raw webhook body and headers
   * @returns Whether the webhook signature is valid
   */
  async verifyWebhookSignature(request: WebhookVerificationRequest): Promise<boolean> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID
    if (!webhookId) {
      console.error('CRITICAL: PAYPAL_WEBHOOK_ID is not set')
      return false
    }

    const transmissionId = request.headers.get('paypal-transmission-id')
    const transmissionTime = request.headers.get('paypal-transmission-time')
    const certUrl = request.headers.get('paypal-cert-url')
    const transmissionSig = request.headers.get('paypal-transmission-sig')
    const authAlgo = request.headers.get('paypal-auth-algo')

    if (!transmissionId || !transmissionTime || !certUrl || !transmissionSig || !authAlgo) {
      return false
    }

    // Validate certUrl to prevent SSRF — only PayPal-owned domains are allowed
    const allowedCertPrefixes = [
      'https://www.paypal.com/',
      'https://api.sandbox.paypal.com/',
      'https://api.paypal.com/',
    ]
    if (!allowedCertPrefixes.some((prefix) => certUrl.startsWith(prefix))) {
      console.error('PayPal webhook cert URL rejected (SSRF protection):', certUrl)
      return false
    }

    const config = getPayPalConfig()
    if (!config.clientId || !config.clientSecret) return false

    const baseUrl = config.sandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com'

    const accessToken = await getPayPalAccessToken(baseUrl, config.clientId, config.clientSecret)
    if (!accessToken) return false

    // Verify the webhook signature
    const verifyResponse = await withTimeout(
      fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: JSON.parse(request.body),
        }),
      }),
      PAYPAL_API_TIMEOUT_MS,
      'verifyWebhookSignature'
    )

    if (!verifyResponse.ok) {
      console.error('PayPal webhook verification request failed:', verifyResponse.status)
      return false
    }

    const verifyData = await verifyResponse.json()
    return verifyData.verification_status === 'SUCCESS'
  }
}
