// Checkout Session Types
export type CheckoutSessionRequest = {
  orderId: string
  successUrl?: string
  cancelUrl?: string
}

export type CheckoutSessionResponse = {
  sessionId: string
  url: string | null
}

// Payment Metadata
export type PaymentMetadata = {
  orderId: string
  orderNumber?: string
  customerEmail?: string
}

// Refund Types
export type RefundRequest = {
  paymentId: string
  amount?: number // Optional - defaults to full refund. Amount in cents.
  reason?: string
}

export type RefundResponse = {
  refundId: string
  amount: number
  status: 'pending' | 'succeeded' | 'failed' | 'canceled'
}

// Webhook Event Types
export type WebhookEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.canceled'
  | 'charge.refunded'
  | 'checkout.session.completed'
  | 'checkout.session.expired'

export type WebhookEventData = {
  id: string
  type: WebhookEventType
  processed: boolean
  createdAt: Date
}
