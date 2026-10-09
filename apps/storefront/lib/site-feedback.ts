import { z } from 'zod'

/**
 * Site feedback: visitors rate the parts of the site they used on a 1–10
 * scale and leave an optional comment. Submitted from the homepage section
 * and the /feedback page; read in /admin/site-feedback.
 */

export const SITE_FEEDBACK_CATEGORIES = [
  { key: 'layout', label: 'Layout', hint: 'How the pages are arranged and how they look' },
  { key: 'accessibility', label: 'Accessibility', hint: 'Readability, contrast, keyboard and screen reader use' },
  { key: 'functionality', label: 'Functionality', hint: 'Everything working the way you expected' },
  { key: 'userInterface', label: 'User interface', hint: 'Buttons, menus and forms' },
  { key: 'findingThings', label: 'Finding what you need', hint: 'Search, menus and categories' },
  { key: 'ordering', label: 'Ordering & checkout', hint: 'Cart, checkout and order tracking' },
  { key: 'mobile', label: 'Mobile experience', hint: 'Using the site on your phone' },
  { key: 'fundraising', label: 'Fundraising site', hint: 'Fundraiser pages and the portal' },
  { key: 'battleArena', label: 'Battle Arena game', hint: 'The 3D fighting game' },
  { key: 'socialSharing', label: 'Social media sharing', hint: 'Sharing products and fundraisers' },
] as const

export type SiteFeedbackCategoryKey = (typeof SITE_FEEDBACK_CATEGORIES)[number]['key']

export const SITE_FEEDBACK_CATEGORY_KEYS = SITE_FEEDBACK_CATEGORIES.map(
  (c) => c.key,
) as [SiteFeedbackCategoryKey, ...SiteFeedbackCategoryKey[]]

export const SITE_FEEDBACK_MIN_RATING = 1
export const SITE_FEEDBACK_MAX_RATING = 10

const ratingSchema = z
  .number()
  .int()
  .min(SITE_FEEDBACK_MIN_RATING)
  .max(SITE_FEEDBACK_MAX_RATING)

export const siteFeedbackSchema = z
  .object({
    ratings: z.partialRecord(z.enum(SITE_FEEDBACK_CATEGORY_KEYS), ratingSchema),
    comment: z.string().trim().max(5000).optional(),
    name: z.string().trim().max(120).optional(),
    email: z.union([z.literal(''), z.string().trim().email().max(320)]).optional(),
    source: z.enum(['homepage', 'feedback-page']).optional(),
  })
  .refine(
    (data) => Object.keys(data.ratings).length > 0 || Boolean(data.comment),
    { message: 'Rate at least one part of the site or leave a comment.' },
  )

export type SiteFeedbackInput = z.infer<typeof siteFeedbackSchema>
export type SiteFeedbackRatings = Partial<Record<SiteFeedbackCategoryKey, number>>

/** Mean of the given ratings, rounded to one decimal, or null when none were given. */
export function averageRating(ratings: SiteFeedbackRatings): number | null {
  const values = Object.values(ratings).filter((v): v is number => typeof v === 'number')
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10
}

/** Read a stored ratings JSON value, keeping only known categories with valid scores. */
export function parseStoredRatings(value: unknown): SiteFeedbackRatings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const ratings: SiteFeedbackRatings = {}
  for (const key of SITE_FEEDBACK_CATEGORY_KEYS) {
    const parsed = ratingSchema.safeParse((value as Record<string, unknown>)[key])
    if (parsed.success) ratings[key] = parsed.data
  }
  return ratings
}

export interface CategorySummary {
  key: SiteFeedbackCategoryKey
  label: string
  count: number
  average: number | null
}

/** Per-category response count and average across a set of submissions. */
export function summarizeByCategory(all: SiteFeedbackRatings[]): CategorySummary[] {
  return SITE_FEEDBACK_CATEGORIES.map(({ key, label }) => {
    const values = all
      .map((r) => r[key])
      .filter((v): v is number => typeof v === 'number')
    return {
      key,
      label,
      count: values.length,
      average:
        values.length === 0
          ? null
          : Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10,
    }
  })
}
