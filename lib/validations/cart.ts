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

// Schema for updating cart item quantity
export const UpdateCartItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(0), // Allow 0 to remove item
})

// Schema for removing an item from cart
export const RemoveCartItemSchema = z.object({
  productId: z.string().cuid(),
})

// Schema for bulk cart operations
export const BulkCartUpdateSchema = z.object({
  items: z.array(CartItemSchema).min(1, 'Cart cannot be empty'),
})

// Schema for getting cart - optional userId for authenticated users
export const GetCartSchema = z.object({
  userId: z.string().cuid().optional(),
  sessionId: z.string().optional(),
}).refine(
  (data) => data.userId || data.sessionId,
  {
    message: 'Either userId or sessionId must be provided',
  }
)

// Schema for merging carts (e.g., when user logs in)
export const MergeCartsSchema = z.object({
  sourceCartId: z.string().cuid(),
  targetCartId: z.string().cuid(),
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
export type GetCart = z.infer<typeof GetCartSchema>
export type MergeCarts = z.infer<typeof MergeCartsSchema>
export type CartCheckout = z.infer<typeof CartCheckoutSchema>
