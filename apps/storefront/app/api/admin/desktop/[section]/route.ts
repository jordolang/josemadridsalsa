import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, getUserPermissions, isStaff } from '@/lib/rbac'
import { loadSection } from '@/lib/admin-desktop/data'
import { canSeeSection } from '@/lib/admin-desktop/access'
import { isDesktopSectionId } from '@/lib/admin-desktop/sections'

/**
 * Section data for the desktop admin shell.
 *
 * The shell switches sections without a page load, so each one is fetched here
 * rather than re-rendered. Two gates, both matching the web panel: the staff
 * check the `/admin` layout makes, and then the section's own permission, the
 * one its `/admin` page checks before rendering. The second matters because
 * this route is the only thing between a session and a loader — without it a
 * STAFF account the web panel redirects away from `/admin/invoices` could still
 * read the same rows here.
 */

export const dynamic = 'force-dynamic'

const SectionParam = z.string().refine(isDesktopSectionId, 'Unknown section')

export async function GET(_request: Request, context: { params: Promise<{ section: string }> }) {
  const user = await getCurrentUser()
  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { section } = await context.params
  const parsed = SectionParam.safeParse(section)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unknown section' }, { status: 404 })
  }

  const permissions = await getUserPermissions(user)
  if (!canSeeSection(parsed.data, permissions)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const payload = await loadSection(parsed.data)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error(`[admin-desktop] failed to load section ${parsed.data}:`, error)
    return NextResponse.json({ error: 'Failed to load section' }, { status: 500 })
  }
}
