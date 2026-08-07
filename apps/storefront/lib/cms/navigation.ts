import { getNavigationMenu } from './queries'
import type { NavigationNode } from './queries'
import type { NavGroup } from '@/components/store/navigation'

/**
 * Map the CMS HEADER menu onto the shape the storefront navigation expects.
 *
 * Top-level items become dropdown groups and their children become the links
 * inside. A top-level item that has no children is rendered as a group with a
 * single entry pointing at itself, so a flat menu still works.
 *
 * Returns `undefined` when no menu has been built, which leaves the header on
 * its built-in links.
 */
export async function getHeaderGroups(): Promise<NavGroup[] | undefined> {
  const nodes = await getNavigationMenu('HEADER')
  if (nodes.length === 0) return undefined

  return nodes.map((node: NavigationNode) => ({
    id: node.id,
    title: node.label,
    ...(node.href && node.href !== '#'
      ? {
          featured: {
            href: node.href,
            label: node.label,
            hint: node.description ?? '',
          },
        }
      : {}),
    items:
      node.children.length > 0
        ? node.children.map((child) => ({
            name: child.label,
            href: child.href,
            description: child.description ?? '',
          }))
        : [{ name: node.label, href: node.href, description: node.description ?? '' }],
  }))
}
