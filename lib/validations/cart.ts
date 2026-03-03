import { z } from 'zod'

/**
 * Cart validation schemas for cart management operations
 * Following patterns from app/api/checkout/route.ts
 */

// Base cart item schema - reusable for various cart operations
export const CartItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive(),
})

// Schema for adding an item to the cart
export const AddCartItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive().default(1),
})

// Schema for updating cart item quantity (route-level: quantity only)
export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().positive(),
})

// Schema for removing an item from cart
export const RemoveCartItemSchema = z.object({
  productId: z.string().cuid(),
})

// Schema for bulk cart operations
export const BulkCartUpdateSchema = z.object({
  items: z.array(CartItemSchema).min(1, 'Cart cannot be empty'),
})

// Schema for cart checkout validation (subset of full checkout)
export const CartCheckoutSchema = z.object({
  items: z
    .array(CartItemSchema)
    .min(1, 'Cart is empty'),
  discountCode: z.string().optional(),
})

// Type exports for use in API routes and components
export type CartItem = z.infer<typeof CartItemSchema>
export type AddCartItem = z.infer<typeof AddCartItemSchema>
export type UpdateCartItem = z.infer<typeof UpdateCartItemSchema>
export type RemoveCartItem = z.infer<typeof RemoveCartItemSchema>
export type BulkCartUpdate = z.infer<typeof BulkCartUpdateSchema>
export type CartCheckout = z.infer<typeof CartCheckoutSchema>
