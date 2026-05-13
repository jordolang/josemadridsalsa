import { z } from 'zod'

const slug = z
  .string()
  .trim()
  .min(3)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a 6-digit hex value like #c0392b')

export const blogPostStatusEnum = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])
export const blogCommentStatusEnum = z.enum(['PENDING', 'APPROVED', 'HIDDEN', 'SPAM'])
export const blogReactionKindEnum = z.enum(['FIRE', 'HEART', 'LAUGH', 'MIND_BLOWN'])

export const blogPostSchema = z.object({
  title: z.string().trim().min(3).max(200),
  subtitle: z.string().trim().max(300).optional().nullable(),
  slug,
  excerpt: z.string().trim().min(10).max(500),
  content: z.string().min(50).max(200_000),
  coverImage: z.string().url().optional().nullable(),
  coverImageAlt: z.string().trim().max(300).optional().nullable(),
  status: blogPostStatusEnum.default('DRAFT'),
  scheduledFor: z.coerce.date().optional().nullable(),
  featured: z.boolean().default(false),
  readingMinutes: z.number().int().min(1).max(120).default(5),
  seoTitle: z.string().trim().max(200).optional().nullable(),
  seoDescription: z.string().trim().max(500).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).default([]),
  authorId: z.string().optional().nullable(),
  seriesId: z.string().optional().nullable(),
  seriesOrder: z.number().int().min(0).optional().nullable(),
  categoryId: z.string().optional().nullable(),
})

export const blogPostUpdateSchema = blogPostSchema.partial()

export const blogSeriesSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug,
  tagline: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
  accentColor: hexColor.optional().nullable(),
  sortOrder: z.number().int().default(0),
  isFeatured: z.boolean().default(false),
})

export const blogCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug,
  description: z.string().trim().max(500).optional().nullable(),
  accentColor: hexColor.optional().nullable(),
  sortOrder: z.number().int().default(0),
})

export const blogCommentSchema = z.object({
  body: z.string().trim().min(2).max(2000),
  parentId: z.string().optional().nullable(),
})

export const blogCommentModerationSchema = z.object({
  status: blogCommentStatusEnum,
})

export const blogReactionSchema = z.object({
  kind: blogReactionKindEnum,
})

export const blogSubscribeSchema = z.object({
  email: z.string().trim().email().max(320),
  firstName: z.string().trim().max(80).optional(),
  seriesSlug: slug.optional(),
  source: z.string().trim().max(80).optional(),
})

export type BlogPostInput = z.infer<typeof blogPostSchema>
export type BlogPostUpdateInput = z.infer<typeof blogPostUpdateSchema>
export type BlogSeriesInput = z.infer<typeof blogSeriesSchema>
export type BlogCategoryInput = z.infer<typeof blogCategorySchema>
export type BlogCommentInput = z.infer<typeof blogCommentSchema>
export type BlogReactionInput = z.infer<typeof blogReactionSchema>
export type BlogSubscribeInput = z.infer<typeof blogSubscribeSchema>
