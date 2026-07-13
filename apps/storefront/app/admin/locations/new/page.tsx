import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import LocationForm from '../_components/LocationForm'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'New Location - Jose Madrid Salsa Admin',
  description: 'Add a new retail store location.',
  pathname: '/admin/locations/new',
})

export default async function NewLocationPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add New Location</h1>
        <p className="text-muted-foreground">
          Create a new retail location where Jose Madrid Salsa products are sold
        </p>
      </div>

      <LocationForm />
    </div>
  )
}

