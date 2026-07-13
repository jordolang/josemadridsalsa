import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import LocationForm from '../../_components/LocationForm'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Edit Location - Jose Madrid Salsa Admin',
  description: 'Edit retail store location details.',
  pathname: '/admin/locations/edit',
})

async function getLocation(id: string) {
  const location = await prisma.retailLocation.findUnique({
    where: { id },
    include: {
      photos: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
    },
  })

  return location
}

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  const location = await getLocation(id)

  if (!location) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Location</h1>
        <p className="text-muted-foreground">{location.businessName}</p>
      </div>

      <LocationForm location={location} />
    </div>
  )
}

