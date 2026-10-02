import { redirect } from 'next/navigation'
import { getCurrentFundraiserAccount } from '@/lib/rbac'
import { AdvancedProfileClient } from '@/components/fundraiser-portal/advanced-profile-client'

export const metadata = {
  title: 'Advanced Profile | Fundraiser Portal',
  description: 'Customize your fundraiser page with advanced CSS and AI features',
}

export default async function AdvancedProfilePage() {
  const account = await getCurrentFundraiserAccount()

  if (!account || !account.fundraiserId) {
    redirect('/auth/signin')
  }

  return <AdvancedProfileClient fundraiserId={account.fundraiserId} />
}
