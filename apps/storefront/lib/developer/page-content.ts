import { z } from 'zod'
import { prisma } from '@/lib/prisma'

/**
 * Editable content for the public /developer page. Stored as a JSON singleton
 * in the developer_page_content table and managed from the Developer Console.
 * The page renders the defaults until the developer customizes it.
 */

/**
 * Stored content saved under an older revision is ignored. Revision 2 (October
 * 2026) dropped the personal copy, the faith statement, the closing quote and
 * the blog preview, so a row saved before then must not bring them back.
 */
export const DEVELOPER_PAGE_CONTENT_REVISION = 2

export const developerPageContentSchema = z.object({
  revision: z.literal(DEVELOPER_PAGE_CONTENT_REVISION),
  hero: z.object({
    badge: z.string().trim().min(1).max(60),
    heading: z.string().trim().min(1).max(80),
    intro: z.string().trim().min(1).max(600),
    primaryCtaLabel: z.string().trim().min(1).max(40),
    primaryCtaHref: z.string().trim().min(1).max(300),
    showPhoto: z.boolean(),
  }),
  about: z.object({
    heading: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(2000),
  }),
  sections: z.object({
    about: z.boolean(),
    stats: z.boolean(),
    timeline: z.boolean(),
    skills: z.boolean(),
    changelog: z.boolean(),
    contact: z.boolean(),
  }),
  contact: z.object({
    heading: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(400),
  }),
})

export type DeveloperPageContentData = z.infer<typeof developerPageContentSchema>

export const DEFAULT_DEVELOPER_PAGE_CONTENT: DeveloperPageContentData = {
  revision: DEVELOPER_PAGE_CONTENT_REVISION,
  hero: {
    badge: 'Full-Stack Developer',
    heading: 'Jordan Lang',
    intro:
      'Lead developer of the Jose Madrid Salsa platform: the online store, the fundraising site, the admin console and the companion apps, built and maintained as one TypeScript codebase.',
    primaryCtaLabel: 'Visit jlang.dev',
    primaryCtaHref: 'https://jlang.dev',
    showPhoto: true,
  },
  about: {
    heading: 'About the Platform',
    body: 'Jose Madrid Salsa runs on a custom platform rather than an off-the-shelf store. It covers online ordering and checkout, school and team fundraisers, wholesale accounts, event sales, inventory, email marketing and bookkeeping, so the business can manage its day-to-day work in one place.',
  },
  sections: {
    about: true,
    stats: true,
    timeline: true,
    skills: true,
    changelog: true,
    contact: true,
  },
  contact: {
    heading: 'Get in Touch',
    description:
      'Questions about the platform, a bug to report, or a project to discuss? Send a message and I will get back to you.',
  },
}

function mergeSection<T extends Record<string, unknown>>(defaults: T, stored: unknown): T {
  if (!stored || typeof stored !== 'object') return defaults
  const merged = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = (stored as Record<string, unknown>)[key as string]
    if (value !== undefined && typeof value === typeof defaults[key]) {
      merged[key] = value as T[keyof T]
    }
  }
  return merged
}

/**
 * Merge a stored (possibly partial or stale) content payload over the defaults.
 */
export function mergeDeveloperPageContent(stored: unknown): DeveloperPageContentData {
  if (!stored || typeof stored !== 'object') return DEFAULT_DEVELOPER_PAGE_CONTENT
  const record = stored as Record<string, unknown>
  if (record.revision !== DEVELOPER_PAGE_CONTENT_REVISION) return DEFAULT_DEVELOPER_PAGE_CONTENT
  return {
    revision: DEVELOPER_PAGE_CONTENT_REVISION,
    hero: mergeSection(DEFAULT_DEVELOPER_PAGE_CONTENT.hero, record.hero),
    about: mergeSection(DEFAULT_DEVELOPER_PAGE_CONTENT.about, record.about),
    sections: mergeSection(DEFAULT_DEVELOPER_PAGE_CONTENT.sections, record.sections),
    contact: mergeSection(DEFAULT_DEVELOPER_PAGE_CONTENT.contact, record.contact),
  }
}

/**
 * Load the developer page content, falling back to defaults when no override
 * has been saved or the database is unavailable.
 */
export async function getDeveloperPageContent(): Promise<DeveloperPageContentData> {
  try {
    const row = await prisma.developerPageContent.findUnique({
      where: { singleton: 'singleton' },
    })
    return mergeDeveloperPageContent(row?.content)
  } catch (error) {
    console.warn('[Developer] Failed to load page content, using defaults:', error)
    return DEFAULT_DEVELOPER_PAGE_CONTENT
  }
}
