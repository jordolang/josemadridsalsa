import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import FundraiserForm from '@/components/admin/FundraiserForm'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Edit Fundraiser - Jose Madrid Salsa Admin',
  description: 'Edit fundraiser details.',
  pathname: '/admin/fundraisers',
})

async function getFundraiser(fundraiserId: string) {
  const fundraiser = await prisma.fundraiser.findUnique({
    where: { id: fundraiserId },
  })

  if (!fundraiser) {
    notFound()
  }

  return fundraiser
}

export default async function FundraiserEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:write'))) {
    redirect('/admin/fundraisers')
  }

  const fundraiser = await getFundraiser(id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Fundraiser</h1>
        <p className="text-slate-600">Update fundraiser details</p>
      </div>

      <FundraiserForm fundraiser={fundraiser} />
    </div>
  )
}
