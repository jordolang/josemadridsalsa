import { redirect } from 'next/navigation'
import { getCurrentUser, getUserPermissions, isStaff } from '@/lib/rbac'
import { loadBadges, loadSection } from '@/lib/admin-desktop/data'
import { allowedSectionIds, canSeePage, canSeeSection } from '@/lib/admin-desktop/access'
import { findPage, isDesktopSectionId } from '@/lib/admin-desktop/sections'
import { DesktopShell } from '@/components/admin-desktop/desktop-shell'

/**
 * Server entry for the desktop shell: the same gates the web panel uses, then
 * the requested section rendered on the first paint so the window opens with
 * data rather than a spinner. Every later section is fetched from
 * `/api/admin/desktop/[section]` as the operator moves around.
 *
 * `?section=` is how the macOS and Windows menu bars open a section directly,
 * and `?page=` names one page inside it. Their menu items are plain URLs, so
 * both have to survive a cold load — including through sign-in, which is why
 * the callback carries them back.
 *
 * A section or page the account may not see is treated like one that does not
 * exist: the window opens at the first section it can see rather than refusing,
 * because a menu item or a stale bookmark should not be a dead end. The sidebar
 * and the page strip are built from that same list, so nothing is offered that
 * would be denied.
 */
export default async function DesktopAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[]; page?: string | string[] }>
}) {
  const { section, page } = await searchParams
  const requested = Array.isArray(section) ? section[0] : section
  const requestedPage = Array.isArray(page) ? page[0] : page
  const wanted = requested && isDesktopSectionId(requested) ? requested : undefined
  // A page only counts if it lives in the section that was asked for, so a
  // mismatched pair opens the section rather than jumping somewhere else.
  const wantedPage =
    requestedPage && findPage(requestedPage)?.section.id === wanted ? requestedPage : undefined

  const user = await getCurrentUser()

  if (!user) {
    // Carry the section across the round trip, or a menu item that happens to
    // meet an expired session silently lands on the dashboard instead.
    const callbackUrl = wanted
      ? `/admin-desktop?section=${wanted}${wantedPage ? `&page=${wantedPage}` : ''}`
      : '/admin-desktop'
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  if (!isStaff(user)) {
    redirect('/')
  }

  const permissions = await getUserPermissions(user)
  const visible = allowedSectionIds(permissions)

  if (visible.length === 0) {
    redirect('/admin')
  }

  const openSection = wanted && canSeeSection(wanted, permissions) ? wanted : visible[0]
  const openAt =
    openSection === wanted && wantedPage && canSeePage(wantedPage, permissions) ? wantedPage : openSection

  const [initialSection, badges] = await Promise.all([loadSection(openAt, permissions), loadBadges()])

  return (
    <DesktopShell
      initialSection={initialSection}
      badges={badges}
      operator={{ name: user.name ?? user.email, email: user.email }}
      visibleSections={visible}
    />
  )
}
