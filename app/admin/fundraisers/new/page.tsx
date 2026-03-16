import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import FundraiserForm from '@/components/admin/FundraiserForm'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'New Fundraiser - Jose Madrid Salsa Admin',
  description: 'Create a new fundraising campaign.',
  pathname: '/admin/fundraisers/new',
})

export default async function NewFundraiserPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:write'))) {
    redirect('/admin/fundraisers')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Fundraiser</h1>
        <p className="text-slate-600 mt-1">
          Set up a new fundraising campaign
        </p>
      </div>

      <FundraiserForm />
    </div>
  )
}
