import { redirect } from 'next/navigation'
import { getCurrentUser, getUserPermissions, isStaff } from '@/lib/rbac'
import { loadBadges, loadSection } from '@/lib/admin-desktop/data'
import { allowedSectionIds, canSeeSection } from '@/lib/admin-desktop/access'
import { isDesktopSectionId } from '@/lib/admin-desktop/sections'
import { DesktopShell } from '@/components/admin-desktop/desktop-shell'

/**
 * Server entry for the desktop shell: the same gates the web panel uses, then
 * the requested section rendered on the first paint so the window opens with
 * data rather than a spinner. Every later section is fetched from
 * `/api/admin/desktop/[section]` as the operator moves around.
 *
 * `?section=` is how the macOS and Windows menu bars open a section directly.
 * Their menu items are plain URLs, so the section has to survive a cold load —
 * including through sign-in, which is why the callback carries it back.
 *
 * A section the account may not see is treated like one that does not exist:
 * the window opens at the first section it can see rather than refusing,
 * because a menu item or a stale bookmark should not be a dead end. The sidebar
 * is built from that same list, so nothing is offered that would be denied.
 */
export default async function DesktopAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[] }>
}) {
  const { section } = await searchParams
  const requested = Array.isArray(section) ? section[0] : section
  const wanted = requested && isDesktopSectionId(requested) ? requested : undefined

  const user = await getCurrentUser()

  if (!user) {
    // Carry the section across the round trip, or a menu item that happens to
    // meet an expired session silently lands on the dashboard instead.
    const callbackUrl = wanted ? `/admin-desktop?section=${wanted}` : '/admin-desktop'
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

  const openAt = wanted && canSeeSection(wanted, permissions) ? wanted : visible[0]

  const [initialSection, badges] = await Promise.all([loadSection(openAt), loadBadges()])

  return (
    <DesktopShell
      initialSection={initialSection}
      badges={badges}
      operator={{ name: user.name ?? user.email, email: user.email }}
      visibleSections={visible}
    />
  )
}
