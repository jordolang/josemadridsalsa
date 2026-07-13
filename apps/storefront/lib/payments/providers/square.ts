import { SquareClient, SquareEnvironment, SquareError, WebhooksHelper } from 'square'
import type { Country } from 'square'
import { randomUUID } from 'crypto'
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

function getSquareConfig() {
  return {
    accessToken: process.env.SQUARE_ACCESS_TOKEN || '',
    locationId: process.env.SQUARE_LOCATION_ID || '',
    sandbox: process.env.SQUARE_SANDBOX !== 'false',
    webhookSignatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '',
  }
}

let squareClient: SquareClient | null = null

function getSquareClient(): SquareClient {
  if (squareClient) return squareClient

  const config = getSquareConfig()

  if (!config.accessToken) {
    throw new Error(
      'Square credentials not configured. Set SQUARE_ACCESS_TOKEN.'
    )
  }

  squareClient = new SquareClient({
    token: config.accessToken,
    environment: config.sandbox
      ? SquareEnvironment.Sandbox
      : SquareEnvironment.Production,
  })

  return squareClient
}

function mapSquareStatus(status: string | undefined): PaymentResult['status'] {
  switch (status) {
    case 'COMPLETED':
      return 'SUCCEEDED'
    case 'APPROVED':
    case 'PENDING':
      return 'PROCESSING'
    case 'CANCELED':
    case 'FAILED':
      return 'FAILED'
    default:
      return 'REQUIRES_ACTION'
  }
}

function getSquareErrorMessage(error: unknown): string {
  if (error instanceof SquareError) {
    return error.message || 'Square API error'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown Square error'
}

export class SquareAdapter implements PaymentProviderAdapter {
  readonly provider: PaymentProvider = 'SQUARE'

  async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
    const client = getSquareClient()
    const config = getSquareConfig()

    if (!config.locationId) {
      return {
        success: false,
        provider: 'SQUARE',
        providerPaymentId: '',
        status: 'FAILED',
        error: 'Square location ID not configured. Set SQUARE_LOCATION_ID.',
      }
    }

    try {
      const response = await client.payments.create({
        sourceId: 'EXTERNAL',
        idempotencyKey: randomUUID(),
        amountMoney: {
          amount: BigInt(request.amount),
          currency: request.currency.toUpperCase() as 'USD',
        },
        locationId: config.locationId,
        referenceId: request.orderId,
        note: `Order ${request.orderNumber}`,
        buyerEmailAddress: request.customerEmail,
        ...(request.shippingAddress
          ? {
              shippingAddress: {
                addressLine1: request.shippingAddress.line1,
                ...(request.shippingAddress.line2 ? { addressLine2: request.shippingAddress.line2 } : {}),
                locality: request.shippingAddress.city,
                administrativeDistrictLevel1: request.shippingAddress.state,
                postalCode: request.shippingAddress.postalCode,
                country: request.shippingAddress.country as Country,
              },
            }
          : {}),
        ...(request.customerId ? { customerId: request.customerId } : {}),
      })

      const payment = response.payment
      if (!payment) {
        return {
          success: false,
          provider: 'SQUARE',
          providerPaymentId: '',
          status: 'FAILED',
          error: 'Square returned no payment object',
        }
      }

      return {
        success: true,
        provider: 'SQUARE',
        providerPaymentId: payment.id || '',
        status: mapSquareStatus(payment.status),
      }
    } catch (error) {
      return {
        success: false,
        provider: 'SQUARE',
        providerPaymentId: '',
        status: 'FAILED',
        error: getSquareErrorMessage(error),
      }
    }
  }

  async confirmPayment(providerPaymentId: string): Promise<PaymentResult> {
    const client = getSquareClient()

    try {
      const response = await client.payments.get({ paymentId: providerPaymentId })
      const payment = response.payment

      if (!payment) {
        return {
          success: false,
          provider: 'SQUARE',
          providerPaymentId,
          status: 'FAILED',
          error: 'Payment not found',
        }
      }

      const isCompleted = payment.status === 'COMPLETED'

      return {
        success: isCompleted,
        provider: 'SQUARE',
        providerPaymentId,
        status: mapSquareStatus(payment.status),
        error: isCompleted ? undefined : `Square payment status: ${payment.status}`,
      }
    } catch (error) {
      return {
        success: false,
        provider: 'SQUARE',
        providerPaymentId,
        status: 'FAILED',
        error: getSquareErrorMessage(error),
      }
    }
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const client = getSquareClient()

    try {
      const response = await client.refunds.refundPayment({
        idempotencyKey: randomUUID(),
        paymentId: request.providerPaymentId,
        amountMoney: {
          amount: BigInt(request.amount ?? 0),
          currency: 'USD',
        },
        reason: request.reason,
      })

      const refund = response.refund
      if (!refund) {
        return {
          success: false,
          provider: 'SQUARE',
          providerRefundId: '',
          amount: request.amount || 0,
          status: 'FAILED',
          error: 'Square returned no refund object',
        }
      }

      const isCompleted = refund.status === 'COMPLETED'

      return {
        success: isCompleted || refund.status === 'PENDING',
        provider: 'SQUARE',
        providerRefundId: refund.id || '',
        amount: request.amount || Number(refund.amountMoney?.amount || 0),
        status: isCompleted ? 'SUCCEEDED' : 'PENDING',
        error: isCompleted || refund.status === 'PENDING'
          ? undefined
          : `Refund status: ${refund.status}`,
      }
    } catch (error) {
      return {
        success: false,
        provider: 'SQUARE',
        providerRefundId: '',
        amount: request.amount || 0,
        status: 'FAILED',
        error: getSquareErrorMessage(error),
      }
    }
  }

  async createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, string>
  ): Promise<CustomerResult> {
    const client = getSquareClient()

    try {
      const nameParts = name.split(' ')
      const givenName = nameParts[0] || ''
      const familyName = nameParts.slice(1).join(' ') || ''

      const response = await client.customers.create({
        idempotencyKey: randomUUID(),
        emailAddress: email,
        givenName,
        familyName,
        referenceId: metadata?.userId,
        note: metadata ? JSON.stringify(metadata) : undefined,
      })

      return {
        providerId: response.customer?.id || '',
        provider: 'SQUARE',
      }
    } catch (error) {
      throw new Error(`Square customer creation failed: ${getSquareErrorMessage(error)}`)
    }
  }

  async listPaymentMethods(_customerId: string): Promise<SavedPaymentMethod[]> {
    // Square Cards on File require the Square Cards API.
    // For now, return empty -- POS terminal payments don't use saved cards.
    return []
  }

  async detachPaymentMethod(_paymentMethodId: string): Promise<void> {
    // No-op -- see listPaymentMethods note above.
  }

  async verifyWebhookSignature(request: WebhookVerificationRequest): Promise<boolean> {
    const config = getSquareConfig()

    if (!config.webhookSignatureKey) {
      console.error('CRITICAL: SQUARE_WEBHOOK_SIGNATURE_KEY is not set')
      return false
    }

    const signature = request.headers.get('x-square-hmacsha256-signature')
    if (!signature) return false

    const notificationUrl = process.env.SQUARE_WEBHOOK_URL
    if (!notificationUrl) {
      console.error('CRITICAL: SQUARE_WEBHOOK_URL is not set')
      return false
    }

    try {
      return await WebhooksHelper.verifySignature({
        requestBody: request.body,
        signatureHeader: signature,
        signatureKey: config.webhookSignatureKey,
        notificationUrl,
      })
    } catch {
      return false
    }
  }
}
