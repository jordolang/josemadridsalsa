import { NextResponse } from 'next/server'
import { getCurrentUser, isStaff } from '@/lib/rbac'
import { loadBadges } from '@/lib/admin-desktop/data'

/**
 * The sidebar counts on their own, for the desktop shell to poll.
 *
 * A section reload carries them too, but a reload only runs while the window
 * is on screen. This is what keeps the dock and taskbar badge, and the
 * new-order notification, current while the window is hidden. Counts only —
 * the same staff gate as the shell, and no rows.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    return NextResponse.json(await loadBadges(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[admin-desktop] badges failed:', error)
    return NextResponse.json({ error: 'Failed to load badges' }, { status: 500 })
  }
}
