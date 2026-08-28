import { redirect } from 'next/navigation'
import { getCurrentUser, isStaff } from '@/lib/rbac'
import { loadBadges, loadSection } from '@/lib/admin-desktop/data'
import { isDesktopSectionId } from '@/lib/admin-desktop/sections'
import { DesktopShell } from '@/components/admin-desktop/desktop-shell'

/**
 * Server entry for the desktop shell: the same staff gate the web panel uses,
 * then the requested section rendered on the first paint so the window opens
 * with data rather than a spinner. Every later section is fetched from
 * `/api/admin/desktop/[section]` as the operator moves around.
 *
 * `?section=` is how the macOS and Windows menu bars open a section directly.
 * Their menu items are plain URLs, so the section has to survive a cold load;
 * an unknown or missing one falls back to the dashboard rather than erroring,
 * because a stale bookmark should still open the window.
 */
export default async function DesktopAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[] }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin?callbackUrl=/admin-desktop')
  }

  if (!isStaff(user)) {
    redirect('/')
  }

  const { section } = await searchParams
  const requested = Array.isArray(section) ? section[0] : section
  const openAt = requested && isDesktopSectionId(requested) ? requested : 'dashboard'

  const [initialSection, badges] = await Promise.all([loadSection(openAt), loadBadges()])

  return (
    <DesktopShell
      initialSection={initialSection}
      badges={badges}
      operator={{ name: user.name ?? user.email, email: user.email }}
    />
  )
}
