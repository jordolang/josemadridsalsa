import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { createMetadata } from '@/lib/metadata'
import { Button } from '@/components/ui/button'
import { getAppSettings } from '@/lib/fundraiser-app/admin'
import { FundraiserAppError } from '@/lib/fundraiser-app/errors'
import { MobileAppClient } from './mobile-app-client'

export const metadata: Metadata = createMetadata({
  title: 'Mobile App Access - Jose Madrid Salsa Admin',
  description: 'Control group IDs, PINs and the organizer seat for the mobile fundraiser app.',
  pathname: '/admin/fundraisers',
})

export default async function FundraiserMobileAppPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/admin/fundraisers')
  }

  const canWrite = await hasPermission(user, 'orders:write')
  const settings = await getAppSettings(id).catch((error) => {
    if (error instanceof FundraiserAppError && error.status === 404) notFound()
    throw error
  })

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/fundraisers/${settings.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Campaign
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold">Mobile App Access</h1>
        <p className="text-muted-foreground">
          {settings.name} - {settings.organizationName}
        </p>
      </div>

      <MobileAppClient initial={JSON.parse(JSON.stringify(settings))} canWrite={canWrite} />
    </div>
  )
}
