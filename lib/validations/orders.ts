import { z } from 'zod'

/**
 * Order validation schemas for order management operations
 * Following patterns from app/api/checkout/route.ts
 */

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
})

// Full checkout/order creation schema
export const CheckoutSchema = z.object({
  items: z
    .array(OrderItemSchema)
    .min(1, 'Cart is empty'),
  customer: CustomerInfoSchema,
  shipping: ShippingAddressSchema,
  notes: z.string().optional(),
  discountCode: z.string().optional(),
  recoveryToken: z.string().optional(),
})

// Order status update schema
export const UpdateOrderStatusSchema = z.object({
  orderId: z.string().cuid(),
  status: z.enum([
    'PENDING',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ]),
  notes: z.string().optional(),
})

// Order payment status update schema
export const UpdateOrderPaymentStatusSchema = z.object({
  orderId: z.string().cuid(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']),
})

// Order query/filter schema for listing orders
export const OrderQuerySchema = z.object({
  userId: z.string().cuid().optional(),
  status: z.enum([
    'PENDING',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ]).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
  orderNumber: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

// Order details retrieval schema
export const GetOrderSchema = z.object({
  orderId: z.string().cuid().optional(),
  orderNumber: z.string().optional(),
}).refine(
  (data) => data.orderId || data.orderNumber,
  {
    message: 'Either orderId or orderNumber must be provided',
  }
)

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
export type Checkout = z.infer<typeof CheckoutSchema>
export type UpdateOrderStatus = z.infer<typeof UpdateOrderStatusSchema>
export type UpdateOrderPaymentStatus = z.infer<typeof UpdateOrderPaymentStatusSchema>
export type OrderQuery = z.infer<typeof OrderQuerySchema>
export type GetOrder = z.infer<typeof GetOrderSchema>
export type CancelOrder = z.infer<typeof CancelOrderSchema>
export type UpdateOrderTracking = z.infer<typeof UpdateOrderTrackingSchema>
