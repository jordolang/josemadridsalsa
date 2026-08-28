import { redirect } from 'next/navigation'
import { getCurrentUser, isStaff } from '@/lib/rbac'
import { loadBadges, loadSection } from '@/lib/admin-desktop/data'
import { DesktopShell } from '@/components/admin-desktop/desktop-shell'

/**
 * Server entry for the desktop shell: the same staff gate the web panel uses,
 * then the dashboard rendered on the first paint so the window opens with data
 * rather than a spinner. Every other section is fetched from
 * `/api/admin/desktop/[section]` as the operator moves around.
 */
export default async function DesktopAdminPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin?callbackUrl=/admin-desktop')
  }

  if (!isStaff(user)) {
    redirect('/')
  }

  const [initialSection, badges] = await Promise.all([loadSection('dashboard'), loadBadges()])

  return (
    <DesktopShell
      initialSection={initialSection}
      badges={badges}
      operator={{ name: user.name ?? user.email, email: user.email }}
    />
  )
}
