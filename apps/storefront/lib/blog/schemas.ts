import { z } from 'zod'
import { TITLE_MIN, TITLE_MAX, DESC_MAX } from '@/lib/seo/analyzer'

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

/** Treat an empty/whitespace override as "not set" so it falls back to title/excerpt. */
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

/**
 * SEO overrides are held to the same snippet limits the SEO analyzer scores
 * against: a title short enough to waste snippet space, or a description long
 * enough to be truncated, is rejected rather than merely warned about.
 */
const seoTitleField = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .min(TITLE_MIN, `SEO title must be at least ${TITLE_MIN} characters to fill the search snippet`)
    .max(TITLE_MAX, `SEO title must be ${TITLE_MAX} characters or fewer or Google truncates it`)
    .nullable()
    .optional()
)

const seoDescriptionField = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .max(DESC_MAX, `SEO description must be ${DESC_MAX} characters or fewer or Google truncates it`)
    .nullable()
    .optional()
)

export const blogPostStatusEnum = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])
export const blogCommentStatusEnum = z.enum(['PENDING', 'APPROVED', 'HIDDEN', 'SPAM'])
export const blogReactionKindEnum = z.enum(['FIRE', 'HEART', 'LAUGH', 'MIND_BLOWN'])
export const blogPostLayoutEnum = z.enum(['STANDARD', 'LONGFORM', 'GALLERY', 'VIDEO', 'MINIMAL'])

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
  seoTitle: seoTitleField,
  seoDescription: seoDescriptionField,
  tags: z.array(z.string().trim().min(1).max(50)).default([]),
  layout: blogPostLayoutEnum.default('STANDARD'),
  galleryImages: z.array(z.string().url()).max(24).default([]),
  videoUrl: z.string().url().optional().nullable(),
  authorId: z.string().optional().nullable(),
  seriesId: z.string().optional().nullable(),
  seriesOrder: z.number().int().min(0).optional().nullable(),
  categoryId: z.string().optional().nullable(),
})

export const blogPostUpdateSchema = blogPostSchema.partial()

/** Statuses whose metadata is reachable by crawlers, and so must satisfy the SEO rules. */
const PUBLIC_STATUSES = new Set(['PUBLISHED', 'SCHEDULED'])

export interface PostSeoSubject {
  status: string
  title: string
  excerpt: string
  seoTitle?: string | null
  seoDescription?: string | null
}

/**
 * Enforce the snippet rules against the metadata a crawler actually sees:
 * `seoTitle ?? title` and `seoDescription ?? excerpt`. Without this, a post with
 * no overrides sails past the field-level rules on a 21-character title.
 *
 * Drafts are exempt so a post can be saved while it is still being written; the
 * rules bite when it is published or scheduled.
 *
 * @returns an error message, or null when the post passes.
 */
export function checkPostSeo(post: PostSeoSubject): string | null {
  if (!PUBLIC_STATUSES.has(post.status)) return null

  const title = (post.seoTitle ?? post.title ?? '').trim()
  const fromOverride = Boolean(post.seoTitle?.trim())
  if (title.length < TITLE_MIN) {
    return fromOverride
      ? `SEO title is ${title.length} characters — it must be at least ${TITLE_MIN} to fill the search snippet.`
      : `The post title is ${title.length} characters, which wastes search snippet space. Set an SEO title of ${TITLE_MIN}-${TITLE_MAX} characters, or lengthen the title.`
  }
  if (title.length > TITLE_MAX) {
    return fromOverride
      ? `SEO title is ${title.length} characters — Google truncates past ${TITLE_MAX}.`
      : `The post title is ${title.length} characters and will be truncated in search results. Set an SEO title of ${TITLE_MAX} characters or fewer.`
  }

  const description = (post.seoDescription ?? post.excerpt ?? '').trim()
  if (description.length > DESC_MAX) {
    return post.seoDescription?.trim()
      ? `SEO description is ${description.length} characters — keep it under ${DESC_MAX}.`
      : `The excerpt is ${description.length} characters and will be truncated in search results. Set an SEO description of ${DESC_MAX} characters or fewer, or shorten the excerpt.`
  }

  return null
}

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
