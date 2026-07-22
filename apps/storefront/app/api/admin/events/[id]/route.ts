import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'

const BOOKING_STATUSES = [
  'INTERESTED',
  'APPLIED',
  'WAITLISTED',
  'ACCEPTED',
  'CONFIRMED',
  'DECLINED',
  'CANCELLED',
] as const

interface StaffInput {
  name: string
  role?: string | null
  phone?: string | null
  email?: string | null
  isPrimaryContact?: boolean
  notes?: string | null
}

interface ContactInput {
  name: string
  organization?: string | null
  role?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
}

function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const str = String(value).trim()
  return str.length > 0 ? str : null
}

/**
 * GET /api/admin/events/[id]
 * A single event with its staff, on-file contacts, and manifest.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('events:read')

    const { id } = await params
    const event = await prisma.featuredEvent.findUnique({
      where: { id },
      include: {
        staff: { orderBy: { createdAt: 'asc' } },
        contacts: { orderBy: { createdAt: 'asc' } },
        manifest: { include: { items: true } },
        eventTags: { include: { tag: true } },
      },
    })

    if (!event) {
      return fail('Event not found', 404)
    }

    return ok({ event })
  } catch (error: any) {
    console.error('[GET /api/admin/events/[id]] Error:', error)
    return fail(error.message || 'Failed to fetch event', 500)
  }
}

/**
 * PATCH /api/admin/events/[id]
 * Update event fields. Optionally replaces the full staff and/or contacts lists
 * when a `staff` or `contacts` array is provided.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('events:write')

    const { id } = await params
    const body = await req.json()

    const existing = await prisma.featuredEvent.findUnique({ where: { id } })
    if (!existing) {
      return fail('Event not found', 404)
    }

    const {
      title,
      description,
      location,
      startDate,
      endDate,
      featuredFrom,
      featuredTo,
      isWhereIsJose,
      customDescription,
      displayPriority,
      applicationDeadline,
      bookingStatus,
      boothFee,
      staff,
      contacts,
    } = body

    const event = await prisma.$transaction(async (tx) => {
      const updated = await tx.featuredEvent.update({
        where: { id },
        data: {
          title: title ?? existing.title,
          description:
            description !== undefined ? toNullableString(description) : existing.description,
          location:
            location !== undefined ? toNullableString(location) : existing.location,
          startDate: startDate ? new Date(startDate) : existing.startDate,
          endDate:
            endDate !== undefined
              ? endDate
                ? new Date(endDate)
                : null
              : existing.endDate,
          featuredFrom: featuredFrom ? new Date(featuredFrom) : existing.featuredFrom,
          featuredTo:
            featuredTo !== undefined
              ? featuredTo
                ? new Date(featuredTo)
                : null
              : existing.featuredTo,
          isWhereIsJose:
            isWhereIsJose !== undefined ? Boolean(isWhereIsJose) : existing.isWhereIsJose,
          customDescription:
            customDescription !== undefined
              ? toNullableString(customDescription)
              : existing.customDescription,
          displayPriority:
            displayPriority !== undefined
              ? Number(displayPriority) || 0
              : existing.displayPriority,
          applicationDeadline:
            applicationDeadline !== undefined
              ? applicationDeadline
                ? new Date(applicationDeadline)
                : null
              : existing.applicationDeadline,
          bookingStatus:
            bookingStatus !== undefined && BOOKING_STATUSES.includes(bookingStatus)
              ? bookingStatus
              : existing.bookingStatus,
          boothFee:
            boothFee !== undefined
              ? boothFee === null || boothFee === ''
                ? null
                : Number(boothFee)
              : existing.boothFee,
          // A manual edit means calendar sync should no longer overwrite this event.
          manuallyModified: true,
        },
      })

      if (Array.isArray(staff)) {
        await tx.eventStaff.deleteMany({ where: { eventId: id } })
        for (const person of staff as StaffInput[]) {
          const name = toNullableString(person.name)
          if (!name) continue
          await tx.eventStaff.create({
            data: {
              eventId: id,
              name,
              role: toNullableString(person.role),
              phone: toNullableString(person.phone),
              email: toNullableString(person.email),
              isPrimaryContact: Boolean(person.isPrimaryContact),
              notes: toNullableString(person.notes),
            },
          })
        }
      }

      if (Array.isArray(contacts)) {
        await tx.eventContact.deleteMany({ where: { eventId: id } })
        for (const contact of contacts as ContactInput[]) {
          const name = toNullableString(contact.name)
          if (!name) continue
          await tx.eventContact.create({
            data: {
              eventId: id,
              name,
              organization: toNullableString(contact.organization),
              role: toNullableString(contact.role),
              phone: toNullableString(contact.phone),
              email: toNullableString(contact.email),
              notes: toNullableString(contact.notes),
            },
          })
        }
      }

      return updated
    })

    await logAudit({
      userId: user.id,
      action: 'events.update',
      entityType: 'featuredEvent',
      entityId: event.id,
      changes: { title: event.title },
    })

    return ok({ event })
  } catch (error: any) {
    console.error('[PATCH /api/admin/events/[id]] Error:', error)
    return fail(error.message || 'Failed to update event', 500)
  }
}

/**
 * DELETE /api/admin/events/[id]
 * Delete an event (cascade removes staff, contacts, and manifest).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('events:write')

    const { id } = await params
    const event = await prisma.featuredEvent.findUnique({ where: { id } })
    if (!event) {
      return fail('Event not found', 404)
    }

    await prisma.featuredEvent.delete({ where: { id } })

    await logAudit({
      userId: user.id,
      action: 'events.delete',
      entityType: 'featuredEvent',
      entityId: id,
      changes: { title: event.title },
    })

    return ok({ message: 'Event deleted successfully' })
  } catch (error: any) {
    console.error('[DELETE /api/admin/events/[id]] Error:', error)
    return fail(error.message || 'Failed to delete event', 500)
  }
}
