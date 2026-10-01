import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser, getUserPermissions, isStaff } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { toCsvRow } from '@/lib/csv'
import { loadBadges, loadSection } from '@/lib/admin-desktop/data'
import { EXPORT_LIMIT, filterRows, parseListQuery } from '@/lib/admin-desktop/list'
import type { SectionPayload } from '@/lib/admin-desktop/types'
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
 *
 * `?q=` and `?limit=` set the window of rows read (see `lib/admin-desktop/list`).
 * `?format=csv` returns the same rows as a download instead, narrowed by the
 * filter chip (`?filter=`) and the filter box exactly as the shell narrows them,
 * so an export is what was on screen — without the window's row cap.
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
  const params = new URL(request.url).searchParams
  const requested = params.get('page')
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

  const csv = params.get('format') === 'csv'

  try {
    if (csv) {
      const list = parseListQuery(params, EXPORT_LIMIT)
      const payload = await loadSection(target, permissions, { ...list, limit: EXPORT_LIMIT })
      const filter = Math.max(0, Number.parseInt(params.get('filter') ?? '0', 10) || 0)
      const response = csvResponse(payload, list.q, filter)
      if (!response) return NextResponse.json({ error: 'This page has no table to export' }, { status: 400 })

      await logAuditWithRequest(
        {
          userId: user.id,
          action: 'export',
          entityType: 'DesktopSection',
          entityId: target,
          changes: { q: list.q, filter },
        },
        request,
      )
      return response
    }

    const [payload, badges] = await Promise.all([
      loadSection(target, permissions, parseListQuery(params)),
      loadBadges(),
    ])
    return NextResponse.json({ ...payload, badges }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error(`[admin-desktop] failed to load page ${target}:`, error)
    return NextResponse.json({ error: 'Failed to load page' }, { status: 500 })
  }
}

/**
 * The rows of a table page as a CSV download, streamed a row at a time because
 * a buffered Vercel response stops at 4.5 MB and the customer list alone is
 * close to that. Null for a page with no table.
 */
function csvResponse(payload: SectionPayload, query: string, filter: number): Response | null {
  const { body } = payload
  if (body.view !== 'table' && body.view !== 'events') return null

  const rows = filterRows(body.rows, { query, filter, serverQuery: payload.list?.q })
  const lines = [toCsvRow(body.columns.map((column) => column.label))]
  for (const row of rows) lines.push(toCsvRow(row.cells.map((cell) => cell.text)))

  const encoder = new TextEncoder()
  let next = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = lines.slice(next, next + 500)
      next += chunk.length
      if (chunk.length === 0) controller.close()
      else controller.enqueue(encoder.encode(`${chunk.join('\r\n')}\r\n`))
    },
  })

  const day = new Date().toISOString().slice(0, 10)
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${payload.page.replace(/[^a-z0-9.-]/gi, '-')}-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
