import { z } from 'zod'

/**
 * Order validation schemas for order management operations
 * Following patterns from app/api/checkout/route.ts
 */

// Allowed values derived from Prisma OrderStatus enum
export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const

// Allowed values derived from Prisma PaymentStatus enum
export const PAYMENT_STATUSES = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const

// Base order item schema - reusable for order operations
export const OrderItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive(),
})

// Customer information schema
export const CustomerInfoSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
})

// Shipping address schema
export const ShippingAddressSchema = z.object({
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().default('US'),
})

// Order creation schema (used by POST /api/orders)
export const CreateOrderSchema = z.object({
  cartItemIds: z
    .array(z.string().cuid())
    .min(1, 'Cart is empty'),
  shippingAddress: ShippingAddressSchema,
  billingAddress: ShippingAddressSchema.optional(),
  notes: z.string().optional(),
})

// Order status update schema
export const UpdateOrderStatusSchema = z.object({
  orderId: z.string().cuid(),
  status: z.enum(ORDER_STATUSES),
  notes: z.string().optional(),
})

// Order payment status update schema
export const UpdateOrderPaymentStatusSchema = z.object({
  orderId: z.string().cuid(),
  paymentStatus: z.enum(PAYMENT_STATUSES),
})

// Order query/filter schema for listing orders
export const OrderQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  take: z.coerce.number().int().positive().optional(),
  skip: z.coerce.number().int().min(0).default(0),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Order cancellation schema
export const CancelOrderSchema = z.object({
  orderId: z.string().cuid(),
  reason: z.string().min(1),
  refundAmount: z.number().min(0).optional(),
})

// Order tracking update schema
export const UpdateOrderTrackingSchema = z.object({
  orderId: z.string().cuid(),
  trackingNumber: z.string().min(1),
  carrier: z.string().min(1),
  trackingUrl: z.string().url().optional(),
})

// Type exports for use in API routes and components
export type OrderItem = z.infer<typeof OrderItemSchema>
export type CustomerInfo = z.infer<typeof CustomerInfoSchema>
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>
export type CreateOrder = z.infer<typeof CreateOrderSchema>
export type UpdateOrderStatus = z.infer<typeof UpdateOrderStatusSchema>
export type UpdateOrderPaymentStatus = z.infer<typeof UpdateOrderPaymentStatusSchema>
export type OrderQuery = z.infer<typeof OrderQuerySchema>
export type CancelOrder = z.infer<typeof CancelOrderSchema>
export type UpdateOrderTracking = z.infer<typeof UpdateOrderTrackingSchema>
