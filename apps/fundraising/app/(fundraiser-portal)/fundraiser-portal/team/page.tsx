import { redirect } from 'next/navigation'
import { getCurrentFundraiserAccount } from '@/lib/rbac'
import { TeamClient } from '@/components/fundraiser-portal/team-client'

export const metadata = {
  title: 'Team Access | Fundraiser Portal',
  description: 'Manage write access to your fundraiser page for your team',
}

export default async function TeamPage() {
  const account = await getCurrentFundraiserAccount()

  if (!account || !account.fundraiserId) {
    redirect('/auth/signin')
  }

  return <TeamClient fundraiserId={account.fundraiserId} />
}
