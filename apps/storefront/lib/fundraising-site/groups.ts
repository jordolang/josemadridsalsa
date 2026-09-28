import 'server-only'
import { getFundraisingCheckoutFields, type FundraisingGroupOption } from './checkout-fields'

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
