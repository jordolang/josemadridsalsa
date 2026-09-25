import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { failFromError, notFound } from '@/lib/api'
import { getSeoConfiguration } from '@/lib/seo/configuration'
import { buildIcs, toIcsEvent } from '@/lib/events/ics'
import { SITE_URL } from '@/lib/site-url'

/**
 * GET /api/admin/events/[id]/ics
 *
 * One event as a calendar file, for sharing a single show with staff or a
 * promoter. Admin-only: the booking pipeline is not public.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('events:read')

    const { id } = await params
    const event = await prisma.featuredEvent.findUnique({ where: { id } })
    if (!event) return notFound('Event not found')

    const seo = await getSeoConfiguration()
    const ics = buildIcs([toIcsEvent(event, seo?.siteUrl || SITE_URL)], {
      calendarName: event.title,
    })

    // Slugged from the title so a download folder full of these is readable.
    const slug =
      event.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'event'

    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}.ics"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return failFromError(error, 'Failed to build calendar file')
  }
}
