import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import EventForm, { type EventFormData } from '../../_components/EventForm'

export const metadata: Metadata = createMetadata({
  title: 'Edit Event - Jose Madrid Salsa Admin',
  description: 'Edit a featured event.',
  pathname: '/admin/events/edit',
})

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'events:write'))) {
    redirect('/admin')
  }

  const event = await prisma.featuredEvent.findUnique({
    where: { id },
    include: {
      staff: { orderBy: { createdAt: 'asc' } },
      contacts: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!event) {
    notFound()
  }

  const formData: EventFormData = {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate?.toISOString() ?? null,
    isWhereIsJose: event.isWhereIsJose,
    displayPriority: event.displayPriority,
    applicationDeadline: event.applicationDeadline?.toISOString() ?? null,
    bookingStatus: event.bookingStatus,
    boothFee: event.boothFee?.toString() ?? null,
    staff: event.staff.map((s) => ({
      name: s.name,
      role: s.role ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      isPrimaryContact: s.isPrimaryContact,
      notes: s.notes ?? '',
    })),
    contacts: event.contacts.map((c) => ({
      name: c.name,
      organization: c.organization ?? '',
      role: c.role ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      notes: c.notes ?? '',
    })),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/events">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Event</h1>
            <p className="text-muted-foreground">{event.title}</p>
          </div>
        </div>
        <Link href={`/admin/events/${event.id}/manifest`}>
          <Button variant="outline">
            <ClipboardList className="mr-2 h-4 w-4" />
            Product Manifest
          </Button>
        </Link>
      </div>
      <EventForm event={formData} />
    </div>
  )
}
