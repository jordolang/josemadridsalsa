import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

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
  tags: z.array(z.string()).optional(),
})

export async function GET(request: NextRequest) {
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
