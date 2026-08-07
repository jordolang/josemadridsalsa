import { getFooterSettings, getNavigationMenu } from './queries'
import type { FooterOverrides } from '@/components/ui/footer-column'

/**
 * Collect the CMS footer content.
 *
 * Link columns come from the FOOTER navigation menu (top-level items are the
 * column headings, their children are the links); everything else comes from
 * the footer settings singleton. Returns `undefined` when neither has been
 * configured, leaving the footer on its built-in content.
 */
export async function getFooterOverrides(): Promise<FooterOverrides | undefined> {
  const [settings, menu] = await Promise.all([
    getFooterSettings(),
    getNavigationMenu('FOOTER'),
  ])

  if (!settings && menu.length === 0) return undefined

  const columns = menu
    .filter((node) => node.children.length > 0)
    .map((node) => ({
      title: node.label,
      links: node.children.map((child) => ({ text: child.label, href: child.href })),
    }))

  const social = settings?.socialLinks
  const socialLinks =
    social && typeof social === 'object' && !Array.isArray(social)
      ? Object.entries(social as Record<string, unknown>)
          .filter(([, href]) => typeof href === 'string' && href.trim() !== '')
          .map(([label, href]) => ({ label, href: String(href) }))
      : undefined

  return {
    description: settings?.aboutText ?? undefined,
    copyrightText: settings?.copyrightText ?? undefined,
    contactEmail: settings?.contactEmail ?? undefined,
    contactPhone: settings?.contactPhone ?? undefined,
    address: settings?.addressLines?.length ? settings.addressLines.join(', ') : undefined,
    socialLinks,
    ...(columns.length > 0 ? { columns } : {}),
  }
}
