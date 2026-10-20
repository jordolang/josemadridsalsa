import 'server-only'
import {
  getFundraisingCheckoutFields,
  normalizeGroupName,
  type FundraisingGroupOption,
} from '@/lib/fundraising-site/checkout-fields'
import { prisma } from '@/lib/prisma'

/**
 * The groups taking online orders right now — exactly the fundraising store's
 * checkout dropdown, so a group appears here the moment staff add it there
 * and disappears when they remove it.
 */

export type FundraisingGroup = FundraisingGroupOption & { slug: string }

export function groupSlug(label: string): string {
  return (
    label
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/['‘’]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'group'
  )
}

/** Adds URL slugs, suffixing any that two labels would share. */
export function withSlugs(groups: FundraisingGroupOption[]): FundraisingGroup[] {
  const seen = new Map<string, number>()
  return groups.map((group) => {
    const base = groupSlug(group.label)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return { ...group, slug: count === 1 ? base : `${base}-${count}` }
  })
}

export async function getActiveFundraisingGroups(): Promise<FundraisingGroup[]> {
  const fields = await getFundraisingCheckoutFields()
  return withSlugs(fields.groups).sort((a, b) => a.label.localeCompare(b.label))
}

export async function getActiveFundraisingGroup(slug: string): Promise<FundraisingGroup | null> {
  const groups = await getActiveFundraisingGroups()
  return groups.find((group) => group.slug === slug) ?? null
}

export type DirectoryGroup = { label: string; href: string }

type SiteFundraiser = { name: string; slug: string }

/**
 * One list for /groups: every group in the fundraising store's checkout
 * dropdown, plus the fundraisers running on this site. A site fundraiser whose
 * name is already in the dropdown is listed once, as the store group.
 */
export function mergeGroupDirectory(
  storeGroups: FundraisingGroup[],
  siteFundraisers: SiteFundraiser[],
): DirectoryGroup[] {
  const storeNames = new Set(storeGroups.map((group) => normalizeGroupName(group.label)))
  return [
    ...storeGroups.map((group) => ({ label: group.label, href: `/groups/${group.slug}` })),
    ...siteFundraisers
      .filter((fundraiser) => !storeNames.has(normalizeGroupName(fundraiser.name)))
      .map((fundraiser) => ({ label: fundraiser.name.trim(), href: `/fundraisers/${fundraiser.slug}` })),
  ].sort((a, b) => a.label.localeCompare(b.label))
}

/** Fundraisers set up on this site that are live today. */
export function getActiveSiteFundraisers(now = new Date()): Promise<SiteFundraiser[]> {
  return prisma.fundraiser.findMany({
    where: {
      isActive: true,
      status: 'ACTIVE',
      bigCommerceGroup: null,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    select: { name: true, slug: true },
  })
}

export async function getGroupDirectory(): Promise<DirectoryGroup[]> {
  const [storeGroups, siteFundraisers] = await Promise.all([
    getActiveFundraisingGroups(),
    getActiveSiteFundraisers(),
  ])
  return mergeGroupDirectory(storeGroups, siteFundraisers)
}
