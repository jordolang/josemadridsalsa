import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { format } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { fail, failFromError } from '@/lib/api'
import { getSeoConfiguration } from '@/lib/seo/configuration'
import { buildIcs, toIcsEvent } from '@/lib/events/ics'
import { eventsToCsv } from '@/lib/events/event-export'

/**
 * GET /api/admin/events/export
 *
 * Downloads shows as a calendar file or a spreadsheet.
 *
 *   ?scope=range&from=<iso>&to=<iso>  everything overlapping the window
 *   ?scope=wij                        every "Where is Jose?" event, all dates
 *   &format=ics|csv
 *
 * The window is passed as instants rather than as calendar dates on purpose:
 * the admin is in Ohio and this runs on a UTC host, so letting the browser
 * decide where the week starts is the only way the file matches the grid the
 * user is looking at.
 */

const FALLBACK_SITE_URL = 'https://www.josemadrid.net'

const QuerySchema = z
  .object({
    format: z.enum(['ics', 'csv']).default('ics'),
    scope: z.enum(['range', 'wij']).default('range'),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .refine((q) => q.scope !== 'range' || (q.from && q.to), {
    message: 'from and to are required when scope is "range"',
    path: ['from'],
  })
  .refine((q) => !q.from || !q.to || new Date(q.from) < new Date(q.to), {
    message: 'from must be before to',
    path: ['from'],
  })

/** Filenames go in a Content-Disposition header, so anything exotic is dropped. */
const safeFilename = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '-')

export async function GET(request: NextRequest) {
  try {
    await requirePermission('events:read')

    const parsed = QuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams)
    )
    if (!parsed.success) {
      return fail('Invalid export parameters', 400, parsed.error.issues)
    }
    const query = parsed.data

    const from = query.from ? new Date(query.from) : null
    const to = query.to ? new Date(query.to) : null

    // An event overlaps the window when it starts before the window ends and
    // finishes on or after it begins. Single-day events have no endDate, so
    // their start has to fall inside the window on its own.
    const where =
      query.scope === 'wij'
        ? { isWhereIsJose: true }
        : {
            startDate: { lt: to! },
            OR: [{ endDate: { gte: from! } }, { endDate: null, startDate: { gte: from! } }],
          }

    const events = await prisma.featuredEvent.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: { contacts: { orderBy: { createdAt: 'asc' }, take: 1 } },
    })

    const stamp =
      query.scope === 'wij' ? 'all' : `${format(from!, 'yyyy-MM-dd')}`

    if (query.format === 'csv') {
      const csv = eventsToCsv(
        events.map((event) => ({
          ...event,
          boothFee: event.boothFee === null ? null : Number(event.boothFee),
          costOfFuel: event.costOfFuel === null ? null : Number(event.costOfFuel),
          lodging: event.lodging === null ? null : Number(event.lodging),
          meals: event.meals === null ? null : Number(event.meals),
        }))
      )

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeFilename(
            `jose-events-${stamp}.csv`
          )}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const seo = await getSeoConfiguration()
    const siteUrl = seo?.siteUrl || FALLBACK_SITE_URL

    const ics = buildIcs(
      events.map((event) => toIcsEvent(event, siteUrl)),
      {
        calendarName:
          query.scope === 'wij' ? 'Where is Jose?' : 'Jose Madrid Salsa — Shows',
      }
    )

    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename(
          query.scope === 'wij' ? 'where-is-jose.ics' : `jose-events-${stamp}.ics`
        )}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return failFromError(error, 'Failed to export events')
  }
}
