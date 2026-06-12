import { z } from 'zod'
import { prisma } from '@/lib/prisma'

/**
 * Editable content for the public /developer page. Stored as a JSON singleton
 * in the developer_page_content table and managed from the Developer Console.
 * Defaults mirror the original hard-coded copy so the page renders unchanged
 * until the developer customizes it.
 */

export const developerPageContentSchema = z.object({
  hero: z.object({
    badge: z.string().trim().min(1).max(60),
    heading: z.string().trim().min(1).max(80),
    intro: z.string().trim().min(1).max(600),
    showFaithStatement: z.boolean(),
    faithStatement: z.string().trim().max(1000),
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
    blog: z.boolean(),
    timeline: z.boolean(),
    skills: z.boolean(),
    changelog: z.boolean(),
    contact: z.boolean(),
    closing: z.boolean(),
  }),
  contact: z.object({
    heading: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(400),
  }),
  closing: z.object({
    quote: z.string().trim().min(1).max(600),
    cite: z.string().trim().max(120),
  }),
})

export type DeveloperPageContentData = z.infer<typeof developerPageContentSchema>

export const DEFAULT_DEVELOPER_PAGE_CONTENT: DeveloperPageContentData = {
  hero: {
    badge: 'Full-Stack Developer',
    heading: 'Jordan Lang',
    intro:
      "Builder of this project from start to finish. Jose Madrid Salsa's entire digital platform — designed, developed, and delivered completely free, as originally promised.",
    showFaithStatement: true,
    faithStatement:
      '“Soli Deo Gloria” — To God alone be the glory. “As each has received a gift, use it to serve one another, as good stewards of God\'s varied grace” (1 Peter 4:10). “Let us not grow weary of doing good… as we have opportunity, let us do good to everyone” (Galatians 6:9–10).',
    primaryCtaLabel: 'Visit jlang.dev',
    primaryCtaHref: 'https://jlang.dev',
    showPhoto: true,
  },
  about: {
    heading: 'Built with Purpose',
    body: 'This entire platform was built as a gift — no charge, no strings attached. From the first line of code to the final deployment, every feature was crafted to serve Jose Madrid Salsa and its community. However, unfortunately after repeated events, I cannot deliver this work to a company that treats a gift from God as less than human. "Do not neglect to extend hospitality to strangers [especially among the family of believers—being friendly, cordial, and gracious, sharing the comforts of your home and doing your part generously], for by this some have entertained angels without knowing it." - Hebrews 13:2"',
  },
  sections: {
    about: true,
    stats: true,
    blog: true,
    timeline: true,
    skills: true,
    changelog: true,
    contact: true,
    closing: true,
  },
  contact: {
    heading: 'Get in Touch',
    description:
      'Have a question about the project, want to collaborate, or just want to say hello?',
  },
  closing: {
    quote:
      'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.',
    cite: '— Colossians 3:23',
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
  return {
    hero: mergeSection(DEFAULT_DEVELOPER_PAGE_CONTENT.hero, record.hero),
    about: mergeSection(DEFAULT_DEVELOPER_PAGE_CONTENT.about, record.about),
    sections: mergeSection(DEFAULT_DEVELOPER_PAGE_CONTENT.sections, record.sections),
    contact: mergeSection(DEFAULT_DEVELOPER_PAGE_CONTENT.contact, record.contact),
    closing: mergeSection(DEFAULT_DEVELOPER_PAGE_CONTENT.closing, record.closing),
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
