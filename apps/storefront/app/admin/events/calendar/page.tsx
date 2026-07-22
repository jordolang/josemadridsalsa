import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import EventCalendar, { type CalendarEvent } from '../_components/EventCalendar'

export const metadata: Metadata = createMetadata({
  title: 'Event Calendar - Jose Madrid Salsa Admin',
  description: 'Calendar view of booked shows and application deadlines.',
  pathname: '/admin/events/calendar',
})

/**
 * Window of events handed to the client. Wide enough to browse a season in
 * either direction without a round trip, small enough to stay a single query.
 */
function loadWindow() {
  const from = new Date()
  from.setFullYear(from.getFullYear() - 1)
  const to = new Date()
  to.setFullYear(to.getFullYear() + 2)
  return { from, to }
}

export default async function EventCalendarPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'events:read'))) {
    redirect('/admin')
  }

  const { from, to } = loadWindow()

  // An event is in range if it *starts* in the window or its deadline lands in
  // it — a show booked years out still matters if we apply for it this month.
  const events = await prisma.featuredEvent.findMany({
    where: {
      OR: [
        { startDate: { gte: from, lte: to } },
        { applicationDeadline: { gte: from, lte: to } },
      ],
    },
    select: {
      id: true,
      title: true,
      location: true,
      startDate: true,
      endDate: true,
      applicationDeadline: true,
      bookingStatus: true,
      boothFee: true,
      isWhereIsJose: true,
      _count: { select: { staff: true } },
      manifest: { select: { status: true } },
    },
    orderBy: { startDate: 'asc' },
  })

  const calendarEvents: CalendarEvent[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    location: e.location,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    applicationDeadline: e.applicationDeadline?.toISOString() ?? null,
    bookingStatus: e.bookingStatus,
    // Decimal is not serializable across the server/client boundary.
    boothFee: e.boothFee === null ? null : Number(e.boothFee),
    isWhereIsJose: e.isWhereIsJose,
    staffCount: e._count.staff,
    manifestStatus: e.manifest?.status ?? null,
  }))

  return <EventCalendar events={calendarEvents} />
}
