import { z } from 'zod'

export const RoleEnum = z.enum(['ADMIN', 'CUSTOMER', 'WHOLESALE'])
export const HeatLevelEnum = z.enum(['MILD', 'MEDIUM', 'HOT', 'EXTRA_HOT', 'FRUIT'])

export const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional().or(z.literal('')),
  role: RoleEnum,
  password: z.string().min(8),
})

export const UserSetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8),
})

export const CategoryCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
})

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
  featuredImage: z.string().url().optional().or(z.literal('')),
  images: z.array(z.string().url()).optional().default([]),
  metaTitle: z.string().max(70).optional().or(z.literal('')),
  metaDescription: z.string().max(160).optional().or(z.literal('')),
  searchKeywords: z.array(z.string()).optional().default([]),
})

export const ProductCreateSchema = ProductBaseSchema
export const ProductUpdateSchema = ProductBaseSchema

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

export const AdminReplySchema = z.object({
  conversationId: z.string().min(1),
  message: z
    .string()
    .min(1, { message: 'Message cannot be empty.' })
    .max(1000, { message: 'Message must be 1000 characters or fewer.' }),
})

export const RefundRequestSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.enum(['requested_by_customer', 'duplicate', 'fraudulent']).optional(),
})
