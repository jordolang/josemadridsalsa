import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const BOOKING_STATUSES = [
  'INTERESTED',
  'APPLIED',
  'WAITLISTED',
  'ACCEPTED',
  'CONFIRMED',
  'DECLINED',
  'CANCELLED',
] as const

const EventSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  location: z.string().nullish(),
  startDate: z.string(),
  endDate: z.string().nullish(),
  featuredFrom: z.string(),
  featuredTo: z.string().nullish(),
  isWhereIsJose: z.boolean().default(false),
  customDescription: z.string().nullish(),
  displayPriority: z.number().int().optional(),
  applicationDeadline: z.string().nullish(),
  bookingStatus: z.enum(BOOKING_STATUSES).optional(),
  boothFee: z.number().nonnegative().nullish(),
  tags: z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
  // This response carries booking-pipeline data (which shows we have applied
  // to but not been accepted for, and what we are paying for a booth), so it
  // is admin-only. The public "Where is Jose?" pages read the DB directly.
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const permitted = await hasPermission(session.user as any, 'events:read')
  if (!permitted) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const whereIsJose = searchParams.get('whereIsJose') === 'true'
  const featured = searchParams.get('featured') === 'true'

  const events = await prisma.featuredEvent.findMany({
    where: {
      ...(whereIsJose && { isWhereIsJose: true }),
      ...(featured && {
        featuredFrom: { lte: new Date() },
        OR: [
          { featuredTo: null },
          { featuredTo: { gte: new Date() } },
        ],
      }),
    },
    include: {
      eventTags: {
        include: {
          tag: true,
        },
      },
      manifest: { select: { status: true } },
      _count: { select: { staff: true, contacts: true } },
    },
    orderBy: { startDate: 'asc' },
  })

  return NextResponse.json(events)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permitted = await hasPermission(session.user as any, 'events:write')
    if (!permitted) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()
    const validated = EventSchema.parse(data)

    const event = await prisma.featuredEvent.create({
      data: {
        title: validated.title,
        description: validated.description,
        location: validated.location,
        startDate: new Date(validated.startDate),
        endDate: validated.endDate ? new Date(validated.endDate) : null,
        featuredFrom: new Date(validated.featuredFrom),
        featuredTo: validated.featuredTo ? new Date(validated.featuredTo) : null,
        isWhereIsJose: validated.isWhereIsJose,
        customDescription: validated.customDescription,
        displayPriority: validated.displayPriority ?? 0,
        applicationDeadline: validated.applicationDeadline
          ? new Date(validated.applicationDeadline)
          : null,
        bookingStatus: validated.bookingStatus ?? 'CONFIRMED',
        boothFee: validated.boothFee ?? null,
        manuallyModified: true,
      },
    })

    if (validated.tags && validated.tags.length > 0) {
      for (const tagId of validated.tags) {
        await prisma.eventTag.create({
          data: {
            eventId: event.id,
            tagId,
          },
        })
      }
    }

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Event creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create event', details: String(error) },
      { status: 500 }
    )
  }
}
