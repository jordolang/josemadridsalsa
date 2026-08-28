import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, isStaff } from '@/lib/rbac'
import { loadSection } from '@/lib/admin-desktop/data'
import { isDesktopSectionId } from '@/lib/admin-desktop/sections'

/**
 * Section data for the desktop admin shell.
 *
 * The shell switches sections without a page load, so each one is fetched here
 * rather than re-rendered. Access is the same staff check the `/admin` layout
 * makes — this is the same data behind the same session, in a different frame.
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

  try {
    const payload = await loadSection(parsed.data)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error(`[admin-desktop] failed to load section ${parsed.data}:`, error)
    return NextResponse.json({ error: 'Failed to load section' }, { status: 500 })
  }
}
