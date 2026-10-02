import { redirect } from 'next/navigation'
import { CharacterSelector } from '@/components/fundraiser-portal/character-selector'
import { getCurrentFundraiserAccount } from '@/lib/rbac'

export default async function FundraiserCharacterPage() {
  const account = await getCurrentFundraiserAccount()
  if (!account) redirect('/auth/signin')

  return <CharacterSelector />
}
