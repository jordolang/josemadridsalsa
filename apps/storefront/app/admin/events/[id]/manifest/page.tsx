import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import ManifestEditor from '../../_components/ManifestEditor'

export const metadata: Metadata = createMetadata({
  title: 'Event Manifest - Jose Madrid Salsa Admin',
  description: 'Product manifest for an event: taken, returned, and units sold.',
  pathname: '/admin/events/manifest',
})

export default async function EventManifestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'events:read'))) {
    redirect('/admin')
  }

  const event = await prisma.featuredEvent.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!event) {
    notFound()
  }

  return <ManifestEditor eventId={id} />
}
