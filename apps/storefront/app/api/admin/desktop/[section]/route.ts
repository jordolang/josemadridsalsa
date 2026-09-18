import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, getUserPermissions, isStaff } from '@/lib/rbac'
import { loadSection } from '@/lib/admin-desktop/data'
import { canSeePage, canSeeSection } from '@/lib/admin-desktop/access'
import { findPage, isDesktopSectionId } from '@/lib/admin-desktop/sections'

/**
 * Page data for the desktop admin shell.
 *
 * The shell switches pages without a page load, so each one is fetched here
 * rather than re-rendered. Three gates, all matching the web panel: the staff
 * check the `/admin` layout makes, the section's own permission, and then the
 * page's where it asks for more than its section does. The last two matter
 * because this route is the only thing between a session and a loader —
 * without them a STAFF account the web panel redirects away from
 * `/admin/invoices` could still read the same rows here, and an account
 * without `credentials:read` could list the vault.
 */

export const dynamic = 'force-dynamic'

const SectionParam = z.string().refine(isDesktopSectionId, 'Unknown section')

export async function GET(request: Request, context: { params: Promise<{ section: string }> }) {
  const user = await getCurrentUser()
  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { section } = await context.params
  const parsed = SectionParam.safeParse(section)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unknown section' }, { status: 404 })
  }

  // A page has to belong to the section in the path, or `?page=` would be a way
  // to read any section's rows through a section this account happens to hold.
  const requested = new URL(request.url).searchParams.get('page')
  const entry = requested ? findPage(requested) : undefined
  if (requested && entry?.section.id !== parsed.data) {
    return NextResponse.json({ error: 'Unknown page' }, { status: 404 })
  }

  const permissions = await getUserPermissions(user)
  const allowed = entry ? canSeePage(entry.page.id, permissions) : canSeeSection(parsed.data, permissions)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const target = entry?.page.id ?? parsed.data

  try {
    const payload = await loadSection(target, permissions)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error(`[admin-desktop] failed to load page ${target}:`, error)
    return NextResponse.json({ error: 'Failed to load page' }, { status: 500 })
  }
}
