import { redirect } from 'next/navigation'
import { getCurrentFundraiserAccount } from '@/lib/rbac'
import { AnalyticsClient } from '@/components/fundraiser-portal/analytics-client'

export const metadata = {
  title: 'Analytics & SEO | Fundraiser Portal',
  description: 'Manage Google integrations and SEO for your fundraiser page',
}

export default async function AnalyticsPage() {
  const account = await getCurrentFundraiserAccount()

  if (!account || !account.fundraiserId) {
    redirect('/auth/login')
  }

  return <AnalyticsClient fundraiserId={account.fundraiserId} />
}
