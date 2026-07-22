import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import EventImporter from '../_components/EventImporter'

export const metadata: Metadata = createMetadata({
  title: 'Import Events - Jose Madrid Salsa Admin',
  description: 'Import booked shows from a FestivalNet CSV export.',
  pathname: '/admin/events/import',
})

export default async function ImportEventsPage() {
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
          <h1 className="text-3xl font-bold">Import Events</h1>
          <p className="text-muted-foreground">
            Load shows from a FestivalNet &ldquo;Export My List&rdquo; CSV.
          </p>
        </div>
      </div>
      <EventImporter />
    </div>
  )
}
