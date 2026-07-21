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

export default async function NewEventPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'events:write'))) {
    redirect('/admin')
  }

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
      <EventForm />
    </div>
  )
}
