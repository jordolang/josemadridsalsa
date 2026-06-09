import { z } from 'zod'

/** Allowed user roles for admin-created accounts */
export const RoleEnum = z.enum(['ADMIN', 'CUSTOMER', 'WHOLESALE'])

/** Salsa heat level classification options */
export const HeatLevelEnum = z.enum(['MILD', 'MEDIUM', 'HOT', 'EXTRA_HOT', 'FRUIT'])

/** Schema for creating a new user account (admin panel) */
export const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional().or(z.literal('')),
  role: RoleEnum,
  password: z.string().min(8),
})

/** Schema for resetting a user's password by admin */
export const UserSetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8),
})

/** Schema for creating a product category */
export const CategoryCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
})

/** Base schema for product creation and updates with all product fields */
export const ProductBaseSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional().or(z.literal('')),
  price: z.coerce.number().nonnegative(),
  compareAtPrice: z.coerce.number().nonnegative().optional().nullable(),
  sku: z.string().min(1),
  inventory: z.coerce.number().int().nonnegative(),
  heatLevel: HeatLevelEnum,
  categoryId: z.string().min(1),
  isActive: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
  featuredImage: z.string().min(1).optional().or(z.literal('')),
  images: z.array(z.string().min(1)).optional().default([]),
  metaTitle: z.string().max(70).optional().or(z.literal('')),
  metaDescription: z.string().max(160).optional().or(z.literal('')),
  searchKeywords: z.array(z.string()).optional().default([]),
})

/** Schema for creating a new product (alias of ProductBaseSchema) */
export const ProductCreateSchema = ProductBaseSchema

/** Schema for updating an existing product (alias of ProductBaseSchema) */
export const ProductUpdateSchema = ProductBaseSchema

/** Schema for starting a new customer message/conversation */
export const MessageStartSchema = z.object({
  subject: z
    .string()
    .max(120, { message: 'Subject must be 120 characters or fewer.' })
    .optional()
    .or(z.literal('')),
  message: z
    .string()
    .min(1, { message: 'Message cannot be empty.' })
    .max(1000, { message: 'Message must be 1000 characters or fewer.' }),
  email: z.string().email().optional(),
})

/** Schema for an admin reply to a customer message thread */
export const AdminReplySchema = z.object({
  conversationId: z.string().min(1),
  message: z
    .string()
    .min(1, { message: 'Message cannot be empty.' })
    .max(1000, { message: 'Message must be 1000 characters or fewer.' }),
})

/** Schema for requesting a refund on an order */
export const RefundRequestSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.enum(['requested_by_customer', 'duplicate', 'fraudulent']).optional(),
})
