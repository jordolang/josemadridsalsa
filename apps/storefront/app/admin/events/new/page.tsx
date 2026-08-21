import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import EventForm from '../_components/EventForm'

export const metadata: Metadata = createMetadata({
  title: 'New Event - Jose Madrid Salsa Admin',
  description: 'Create a new featured event.',
  pathname: '/admin/events/new',
})

/** `date=YYYY-MM-DD` only; anything else is ignored rather than guessed at. */
const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; whereIsJose?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'events:write'))) {
    redirect('/admin')
  }

  // Prefill from the week grid's "add an event on this day". No trailing Z:
  // the form parses this in the browser's timezone, and a UTC instant would
  // land the show on the previous evening for anyone west of the meridian.
  const { date, whereIsJose } = await searchParams
  const startDate = date && DATE_PARAM.test(date) ? `${date}T00:00:00` : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/events">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Event</h1>
          <p className="text-muted-foreground">Add an event and its staff and contacts.</p>
        </div>
      </div>
      <EventForm
        event={{
          title: '',
          displayPriority: 0,
          startDate,
          isWhereIsJose: whereIsJose === '1',
        }}
      />
    </div>
  )
}
