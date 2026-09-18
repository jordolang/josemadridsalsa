import { cache } from 'react'
import prisma from '@/lib/prisma'
import { isMissingTableError } from '@/lib/prisma-errors'
import { matchesPath } from './paths'
import { parseBlockData } from './blocks'
import { getSystemPage } from './system-pages'
import type { SystemPageDefinition } from './system-pages'

export { matchesPath }

/**
 * Public read helpers for CMS content.
 *
 * Every export is wrapped in React's `cache()` so a request that renders the
 * navigation, the footer and the announcement bar issues one query each rather
 * than one per component. That is request-level deduplication; cross-request
 * caching comes from each public page's own `revalidate` window.
 *
 * These run on the public storefront, so they must never throw: a CMS table
 * that has not been migrated yet, or malformed section data, degrades to the
 * hard-coded defaults the storefront shipped with.
 */

export interface ResolvedSection {
  key: string
  block: string
  isVisible: boolean
  sortOrder: number
  data: Record<string, unknown>
}

export interface ResolvedPage {
  slug: string
  title: string
  isPublished: boolean
  seo: {
    seoTitle: string | null
    seoDescription: string | null
    ogImage: string | null
    canonicalUrl: string | null
    noIndex: boolean
  }
  sections: ResolvedSection[]
  /** Whether a section should render. Unknown keys default to visible. */
  isVisible(key: string): boolean
  /** A string field with a fallback to the storefront's original copy. */
  text(key: string, field: string, fallback?: string): string
  /** A numeric field with a fallback. */
  number(key: string, field: string, fallback: number): number
}

function now(): Date {
  return new Date()
}

/** True when a status + scheduling window means "show this to the public". */
export function isLive(entity: {
  status: string
  startsAt?: Date | null
  endsAt?: Date | null
  publishedAt?: Date | null
}): boolean {
  const at = now()
  if (entity.status === 'PUBLISHED') {
    // fall through to the window check
  } else if (entity.status === 'SCHEDULED') {
    if (!entity.publishedAt || entity.publishedAt > at) return false
  } else {
    return false
  }
  if (entity.startsAt && entity.startsAt > at) return false
  if (entity.endsAt && entity.endsAt < at) return false
  return true
}

function emptyPage(definition: SystemPageDefinition | undefined, slug: string): ResolvedPage {
  return buildResolvedPage(slug, definition?.title ?? slug, false, null, [])
}

function buildResolvedPage(
  slug: string,
  title: string,
  isPublished: boolean,
  seoSource: {
    seoTitle: string | null
    seoDescription: string | null
    ogImage: string | null
    canonicalUrl: string | null
    noIndex: boolean
  } | null,
  sections: ResolvedSection[]
): ResolvedPage {
  const byKey = new Map(sections.map((section) => [section.key, section]))
  return {
    slug,
    title,
    isPublished,
    seo: seoSource ?? {
      seoTitle: null,
      seoDescription: null,
      ogImage: null,
      canonicalUrl: null,
      noIndex: false,
    },
    sections,
    isVisible(key) {
      const section = byKey.get(key)
      return section ? section.isVisible : true
    },
    text(key, field, fallback = '') {
      const value = byKey.get(key)?.data?.[field]
      return typeof value === 'string' && value.trim() !== '' ? value : fallback
    },
    number(key, field, fallback) {
      const value = byKey.get(key)?.data?.[field]
      return typeof value === 'number' && Number.isFinite(value) ? value : fallback
    },
  }
}

/**
 * Load a SYSTEM page's overrides. Sections the editor has never touched are
 * absent from the result, so `text()` falls back to the caller's default —
 * which is the copy the storefront already had.
 */
export const getPageContent = cache(async (slug: string): Promise<ResolvedPage> => {
  const definition = getSystemPage(slug)
  try {
    const page = await prisma.page.findUnique({
      where: { slug },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!page || !isLive(page)) return emptyPage(definition, slug)

    const sections: ResolvedSection[] = page.sections.map((section) => {
      const blockType =
        definition?.sections.find((s) => s.key === section.type)?.block ?? section.type
      return {
        key: section.type,
        block: blockType,
        isVisible: section.isVisible,
        sortOrder: section.sortOrder,
        data: parseBlockData(blockType, section.data),
      }
    })

    return buildResolvedPage(page.slug, page.title, true, page, sections)
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error(`[cms] failed to load page "${slug}":`, error)
    }
    return emptyPage(definition, slug)
  }
})

/** Load a free-form LANDING page for public rendering. */
export const getLandingPage = cache(async (slug: string): Promise<ResolvedPage | null> => {
  try {
    const page = await prisma.page.findFirst({
      where: { slug, kind: 'LANDING' },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' },
          include: { reusableSection: true },
        },
      },
    })
    if (!page || !isLive(page)) return null

    const sections: ResolvedSection[] = page.sections
      .filter((section) => section.isVisible)
      .map((section) => {
        // A section linked to a reusable block renders that block's shared
        // content, so editing it once updates every page using it.
        const source = section.reusableSection
        const type = source?.type ?? section.type
        return {
          key: section.id,
          block: type,
          isVisible: true,
          sortOrder: section.sortOrder,
          data: parseBlockData(type, source ? source.data : section.data),
        }
      })

    return buildResolvedPage(page.slug, page.title, true, page, sections)
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error(`[cms] failed to load landing page "${slug}":`, error)
    }
    return null
  }
})

export const getPublishedLandingSlugs = cache(async (): Promise<string[]> => {
  try {
    const pages = await prisma.page.findMany({
      where: { kind: 'LANDING', status: { in: ['PUBLISHED', 'SCHEDULED'] } },
      select: { slug: true, status: true, publishedAt: true },
    })
    return pages.filter((page) => isLive(page)).map((page) => page.slug)
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[cms] failed to list landing pages:', error)
    }
    return []
  }
})

export interface SitemapLandingPage {
  slug: string
  updatedAt: Date
}

/**
 * Landing pages that belong in the XML sitemap.
 *
 * Same publish rule the public renderer uses — `isLive()` over status and the
 * scheduling window — minus any page the editor marked `noIndex`, since asking
 * Google to crawl a URL we then tell it not to index is a contradiction.
 */
export const getSitemapLandingPages = cache(async (): Promise<SitemapLandingPage[]> => {
  try {
    const pages = await prisma.page.findMany({
      where: {
        kind: 'LANDING',
        status: { in: ['PUBLISHED', 'SCHEDULED'] },
        noIndex: false,
      },
      select: { slug: true, status: true, publishedAt: true, updatedAt: true },
    })
    return pages
      .filter((page) => isLive(page))
      .map((page) => ({ slug: page.slug, updatedAt: page.updatedAt }))
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[cms] failed to list landing pages for the sitemap:', error)
    }
    return []
  }
})

/** The fields the announcement bar renders, plus the paths it targets. */
export interface LiveAnnouncement {
  id: string
  message: string
  variant: string
  ctaText: string | null
  ctaHref: string | null
  dismissible: boolean
  targetPaths: string[]
}

/**
 * Every live announcement, highest priority first. Path targeting is applied by
 * the caller rather than here: the bar picks its announcement from the client
 * via `usePathname()`, because reading the path from `headers()` on the server
 * opted every public route out of static rendering.
 */
export const getLiveAnnouncements = cache(async (): Promise<LiveAnnouncement[]> => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { status: { in: ['PUBLISHED', 'SCHEDULED'] } },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    })
    return announcements.filter(isLive).map((a) => ({
      id: a.id,
      message: a.message,
      variant: a.variant,
      ctaText: a.ctaText,
      ctaHref: a.ctaHref,
      dismissible: a.dismissible,
      targetPaths: a.targetPaths,
    }))
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[cms] failed to load announcements:', error)
    }
    return []
  }
})

/** Live banners for a placement, highest priority first. */
export const getActiveBanners = cache(async (placement: string, pathname: string) => {
  try {
    const banners = await prisma.banner.findMany({
      where: {
        placement: placement as never,
        status: { in: ['PUBLISHED', 'SCHEDULED'] },
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    })
    return banners.filter((b) => isLive(b) && matchesPath(b.targetPaths, pathname))
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[cms] failed to load banners:', error)
    }
    return []
  }
})

export interface NavigationNode {
  id: string
  label: string
  href: string
  description: string | null
  iconName: string | null
  openInNewTab: boolean
  children: NavigationNode[]
}

/**
 * A navigation menu as a tree. Returns an empty array when the menu has not
 * been configured, which lets the storefront keep its hard-coded links.
 */
export const getNavigationMenu = cache(
  async (location: 'HEADER' | 'FOOTER' | 'MOBILE' | 'UTILITY'): Promise<NavigationNode[]> => {
    try {
      const menu = await prisma.navigationMenu.findUnique({
        where: { location },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      })
      if (!menu) return []

      const visible = menu.items.filter((item) => item.isVisible)
      const childrenByParent = new Map<string | null, typeof visible>()
      for (const item of visible) {
        const key = item.parentId
        const bucket = childrenByParent.get(key)
        if (bucket) bucket.push(item)
        else childrenByParent.set(key, [item])
      }

      const build = (parentId: string | null): NavigationNode[] =>
        (childrenByParent.get(parentId) ?? []).map((item) => ({
          id: item.id,
          label: item.label,
          href: item.href,
          description: item.description,
          iconName: item.iconName,
          openInNewTab: item.openInNewTab,
          children: build(item.id),
        }))

      return build(null)
    } catch (error) {
      if (!isMissingTableError(error)) {
        console.error(`[cms] failed to load "${location}" navigation:`, error)
      }
      return []
    }
  }
)

export const getFooterSettings = cache(async () => {
  try {
    return await prisma.footerSettings.findFirst({ orderBy: { updatedAt: 'desc' } })
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[cms] failed to load footer settings:', error)
    }
    return null
  }
})

/** Published FAQ items, optionally filtered to one category. */
export const getFaqs = cache(async (categorySlug?: string, limit?: number) => {
  try {
    return await prisma.faqItem.findMany({
      where: {
        status: 'PUBLISHED',
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { category: true },
      ...(limit ? { take: limit } : {}),
    })
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[cms] failed to load FAQs:', error)
    }
    return []
  }
})

export const getFaqCategories = cache(async () => {
  try {
    return await prisma.faqCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { items: true } } },
    })
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[cms] failed to load FAQ categories:', error)
    }
    return []
  }
})
