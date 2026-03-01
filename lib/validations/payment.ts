import { z } from 'zod'

/**
 * Payment validation schemas for Stripe payment processing
 * Following patterns from app/api/checkout/route.ts
 */

// Payment Method Schema
export const PaymentMethodSchema = z.object({
  type: z.enum(['card', 'us_bank_account', 'link'], {
    errorMap: () => ({ message: 'Invalid payment method type' }),
  }),
  card: z
    .object({
      number: z.string().regex(/^\d{13,19}$/, 'Invalid card number'),
      expMonth: z.number().int().min(1).max(12),
      expYear: z.number().int().min(new Date().getFullYear()),
      cvc: z.string().regex(/^\d{3,4}$/, 'Invalid CVC'),
    })
    .optional(),
  billingDetails: z
    .object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email(),
      phone: z.string().optional(),
      address: z
        .object({
          line1: z.string().min(1),
          line2: z.string().optional(),
          city: z.string().min(1),
          state: z.string().min(1),
          postalCode: z.string().min(1),
          country: z.string().length(2).default('US'),
        })
        .optional(),
    })
    .optional(),
})

// Payment Intent Creation Schema
export const CreatePaymentIntentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).toLowerCase().default('usd'),
  orderId: z.string().cuid(),
  customerEmail: z.string().email(),
  metadata: z
    .object({
      orderNumber: z.string().optional(),
      customerName: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  shipping: z
    .object({
      name: z.string().min(1),
      phone: z.string().optional(),
      address: z.object({
        line1: z.string().min(1),
        line2: z.string().optional(),
        city: z.string().min(1),
        state: z.string().min(1),
        postalCode: z.string().min(1),
        country: z.string().length(2).default('US'),
      }),
    })
    .optional(),
})

// Payment Confirmation Schema
export const ConfirmPaymentSchema = z.object({
  paymentIntentId: z.string().startsWith('pi_', 'Invalid payment intent ID'),
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
  orderId: z.string().cuid(),
  returnUrl: z.string().url().optional(),
})

// Payment Status Update Schema
export const UpdatePaymentStatusSchema = z.object({
  orderId: z.string().cuid(),
  paymentIntentId: z.string().startsWith('pi_'),
  status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED'], {
    errorMap: () => ({ message: 'Invalid payment status' }),
  }),
  metadata: z
    .object({
      failureReason: z.string().optional(),
      failureCode: z.string().optional(),
      processorResponse: z.string().optional(),
    })
    .optional(),
})

// Refund Request Schema
export const RefundRequestSchema = z.object({
  orderId: z.string().cuid(),
  paymentIntentId: z.string().startsWith('pi_'),
  amount: z.number().positive('Refund amount must be positive').optional(),
  reason: z
    .enum(['duplicate', 'fraudulent', 'requested_by_customer'], {
      errorMap: () => ({ message: 'Invalid refund reason' }),
    })
    .default('requested_by_customer'),
  metadata: z
    .object({
      refundedBy: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
})

// Webhook Event Schema
export const StripeWebhookEventSchema = z.object({
  id: z.string().startsWith('evt_'),
  type: z.string().min(1),
  data: z.object({
    object: z.record(z.any()),
  }),
  created: z.number().int().positive(),
  livemode: z.boolean(),
})

// Payment Metadata Schema (for Stripe metadata fields)
export const PaymentMetadataSchema = z.object({
  orderId: z.string().cuid(),
  orderNumber: z.string().min(1),
  customerName: z.string().optional(),
  customerId: z.string().optional(),
  notes: z.string().max(500).optional(),
})

// Payment Amount Validation (in cents)
export const PaymentAmountSchema = z
  .number()
  .int('Amount must be an integer')
  .positive('Amount must be positive')
  .max(99999999, 'Amount exceeds maximum allowed') // $999,999.99

// Stripe Customer Creation Schema
export const CreateStripeCustomerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z
    .object({
      line1: z.string().min(1),
      line2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      postalCode: z.string().min(1),
      country: z.string().length(2).default('US'),
    })
    .optional(),
  metadata: z.record(z.string()).optional(),
})

// Type exports for TypeScript usage
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>
export type CreatePaymentIntent = z.infer<typeof CreatePaymentIntentSchema>
export type ConfirmPayment = z.infer<typeof ConfirmPaymentSchema>
export type UpdatePaymentStatus = z.infer<typeof UpdatePaymentStatusSchema>
export type RefundRequest = z.infer<typeof RefundRequestSchema>
export type StripeWebhookEvent = z.infer<typeof StripeWebhookEventSchema>
export type PaymentMetadata = z.infer<typeof PaymentMetadataSchema>
export type CreateStripeCustomer = z.infer<typeof CreateStripeCustomerSchema>
