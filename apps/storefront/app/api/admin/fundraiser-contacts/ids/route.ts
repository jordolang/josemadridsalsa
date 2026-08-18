import { NextRequest } from 'next/server'
import { z } from 'zod'

import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, failFromError } from '@/lib/api'
import { buildContactWhere } from '@/lib/fundraising/contact-list'

/**
 * GET /api/admin/fundraiser-contacts/ids?<same filters as the list page>
 *
 * Every contact id matching the current view, so "select all N matching" can act on rows that
 * are not on the visible page.
 *
 * Returning ids rather than letting the bulk route accept a filter is deliberate. A filter
 * re-resolved on the server could match a different set than the operator was looking at — a
 * contact edited in another tab, or a filter the client encoded slightly differently — and the
 * bulk route's whole safety property is that it only ever touches ids someone chose. This
 * keeps that property while still making a 2,000-row selection one click.
 */

/** Above this, the response says so rather than silently capping. */
const MAX_IDS = 10_000

/**
 * Filters are user-controlled query parameters, so they are parsed rather than trusted.
 * `buildContactWhere` already ignores unknown enum values, but `search` is interpolated into a
 * Prisma `contains` and future filters would otherwise inherit no validation at all.
 */
const filterSchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'RESPONDED', 'CONVERTED', 'DO_NOT_CONTACT']).optional(),
  source: z
    .enum([
      'ARCHIVE_ORDER_FORM',
      'ARCHIVE_ORDER_EXPORT',
      'CONSTANT_CONTACT',
      'WEBSITE_EXPORT',
      'MANUAL',
    ])
    .optional(),
  active: z.enum(['active', 'inactive']).optional(),
  hasEmail: z.enum(['yes', 'no']).optional(),
  withHistory: z.enum(['yes']).optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requirePermission('users:read')

    const raw = Object.fromEntries(request.nextUrl.searchParams.entries())
    // Drop blanks so an empty `?status=` reads as "no filter" rather than an enum failure.
    const present = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''))

    const parsed = filterSchema.safeParse(present)
    if (!parsed.success) {
      return fail('Invalid filter', 400, parsed.error.flatten())
    }

    const where = buildContactWhere({
      ...parsed.data,
      year: parsed.data.year === undefined ? undefined : String(parsed.data.year),
    })

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
      /** The caller must surface this; a capped selection is not "everything matching". */
      truncated: total > rows.length,
      cap: MAX_IDS,
    })
  } catch (error) {
    // `requirePermission` throws a plain Error, so the message is what distinguishes an
    // access denial from a real failure. Without this, every 401/403 reports as a 500.
    return failFromError(error, 'Could not resolve the selection')
  }
}
