import { NextRequest } from 'next/server'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { buildContactWhere, type ContactFilters } from '@/lib/fundraising/contact-list'

/**
 * GET /api/admin/fundraiser-contacts/ids?<same filters as the list page>
 *
 * Every contact id matching the current view, so "select all N matching" can act on rows that
 * are not on the visible page.
 *
 * Returning ids rather than letting the bulk route accept a filter is deliberate. A filter
 * re-resolved on the server could match a different set than the one the operator was looking
 * at — a contact edited in another tab, or a filter the client encoded slightly differently —
 * and the bulk route's whole safety property is that it only ever touches ids someone chose.
 * This keeps that property while still making a 2,000-row selection one click.
 */

/** Above this, the client is told the selection was truncated rather than silently capped. */
const MAX_IDS = 10_000

export async function GET(request: NextRequest) {
  try {
    await requirePermission('users:read')

    const params = request.nextUrl.searchParams
    const filters: ContactFilters = {
      search: params.get('search') ?? undefined,
      status: params.get('status') ?? undefined,
      source: params.get('source') ?? undefined,
      active: params.get('active') ?? undefined,
      hasEmail: params.get('hasEmail') ?? undefined,
      withHistory: params.get('withHistory') ?? undefined,
      year: params.get('year') ?? undefined,
    }

    const where = buildContactWhere(filters)
    const [rows, total] = await Promise.all([
      prisma.fundraiserContact.findMany({
        where,
        select: { id: true },
        take: MAX_IDS,
        orderBy: { id: 'asc' },
      }),
      prisma.fundraiserContact.count({ where }),
    ])

    return ok({
      ids: rows.map((row) => row.id),
      total,
      truncated: total > rows.length,
    })
  } catch (error) {
    const err = error as { message?: string; status?: number }
    return fail(err.message ?? 'Could not resolve the selection', err.status ?? 500)
  }
}
