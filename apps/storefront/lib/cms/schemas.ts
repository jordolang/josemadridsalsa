import { z } from 'zod'

/**
 * Zod schemas for every CMS admin write endpoint. Route handlers must parse
 * their request body through these before touching Prisma.
 */

const contentStatus = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])

/** Slugs are used directly in public URLs, so keep them URL-safe. */
export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens')

/**
 * Links must stay same-origin or an explicit external URL — this blocks
 * `javascript:` and other script-bearing schemes from being stored and then
 * rendered into an href.
 */
export const linkSchema = z
  .string()
  .max(2048)
  .refine(
    (value) =>
      value === '' ||
      value.startsWith('/') ||
      value.startsWith('https://') ||
      value.startsWith('http://') ||
      value.startsWith('mailto:') ||
      value.startsWith('tel:'),
    'Use a relative path, https:// URL, mailto: or tel: link'
  )

const nullableDate = z.coerce.date().nullable().optional()

export const pageSectionInputSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
  data: z.record(z.string(), z.unknown()).default({}),
  reusableSectionId: z.string().nullable().optional(),
})

export const pageCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(200),
  kind: z.enum(['SYSTEM', 'LANDING']).default('LANDING'),
  status: contentStatus.default('DRAFT'),
  publishedAt: nullableDate,
  scheduledFor: nullableDate,
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  ogImage: z.string().max(2048).nullable().optional(),
  canonicalUrl: z.string().max(2048).nullable().optional(),
  noIndex: z.boolean().default(false),
  sections: z.array(pageSectionInputSchema).default([]),
})

export const pageUpdateSchema = pageCreateSchema.partial().extend({
  sections: z.array(pageSectionInputSchema).optional(),
})

export const reusableSectionSchema = z.object({
  key: slugSchema,
  name: z.string().min(1).max(200),
  type: z.string().min(1),
  data: z.record(z.string(), z.unknown()).default({}),
  status: contentStatus.default('PUBLISHED'),
})

export const bannerSchema = z.object({
  name: z.string().min(1).max(200),
  placement: z
    .enum(['SITE_WIDE_TOP', 'HOMEPAGE_HERO', 'CATEGORY', 'CHECKOUT', 'FUNDRAISING'])
    .default('SITE_WIDE_TOP'),
  headline: z.string().max(300).nullable().optional(),
  body: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().max(2048).nullable().optional(),
  imageAlt: z.string().max(300).nullable().optional(),
  ctaText: z.string().max(100).nullable().optional(),
  ctaHref: linkSchema.nullable().optional(),
  status: contentStatus.default('DRAFT'),
  startsAt: nullableDate,
  endsAt: nullableDate,
  priority: z.number().int().min(0).max(1000).default(0),
  targetPaths: z.array(z.string().max(500)).default([]),
})

export const announcementSchema = z.object({
  message: z.string().min(1).max(500),
  ctaText: z.string().max(100).nullable().optional(),
  ctaHref: linkSchema.nullable().optional(),
  variant: z.enum(['INFO', 'PROMO', 'WARNING', 'SUCCESS']).default('INFO'),
  status: contentStatus.default('DRAFT'),
  startsAt: nullableDate,
  endsAt: nullableDate,
  priority: z.number().int().min(0).max(1000).default(0),
  targetPaths: z.array(z.string().max(500)).default([]),
  dismissible: z.boolean().default(true),
})

export const faqCategorySchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
})

export const faqItemSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(10000),
  categoryId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  status: contentStatus.default('PUBLISHED'),
})

export const navigationItemSchema = z.object({
  id: z.string().optional(),
  parentId: z.string().nullable().optional(),
  label: z.string().min(1).max(120),
  href: linkSchema,
  description: z.string().max(300).nullable().optional(),
  iconName: z.string().max(60).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
  openInNewTab: z.boolean().default(false),
})

export const navigationMenuSchema = z.object({
  location: z.enum(['HEADER', 'FOOTER', 'MOBILE', 'UTILITY']),
  name: z.string().min(1).max(120),
  items: z.array(navigationItemSchema).default([]),
})

export const footerSettingsSchema = z.object({
  tagline: z.string().max(300).nullable().optional(),
  aboutText: z.string().max(2000).nullable().optional(),
  copyrightText: z.string().max(300).nullable().optional(),
  newsletterHeading: z.string().max(200).nullable().optional(),
  newsletterBody: z.string().max(1000).nullable().optional(),
  socialLinks: z.record(z.string(), z.string().max(2048)).nullable().optional(),
  contactEmail: z.string().email().max(200).nullable().optional().or(z.literal('')),
  contactPhone: z.string().max(60).nullable().optional(),
  addressLines: z.array(z.string().max(200)).default([]),
})

/**
 * Redirect sources are matched against `pathname` in middleware, so they must
 * be a root-relative path. Destinations may be internal or external.
 */
export const redirectSchema = z.object({
  source: z
    .string()
    .min(1)
    .max(2048)
    .startsWith('/', 'Source must start with /')
    .refine((value) => !value.includes('//'), 'Source must not contain //'),
  destination: linkSchema.refine((value) => value !== '', 'Destination is required'),
  permanent: z.boolean().default(true),
  isActive: z.boolean().default(true),
  note: z.string().max(500).nullable().optional(),
})

export type PageCreateInput = z.infer<typeof pageCreateSchema>
export type PageUpdateInput = z.infer<typeof pageUpdateSchema>
export type BannerInput = z.infer<typeof bannerSchema>
export type AnnouncementInput = z.infer<typeof announcementSchema>
export type FaqItemInput = z.infer<typeof faqItemSchema>
export type NavigationMenuInput = z.infer<typeof navigationMenuSchema>
export type FooterSettingsInput = z.infer<typeof footerSettingsSchema>
export type RedirectInput = z.infer<typeof redirectSchema>
