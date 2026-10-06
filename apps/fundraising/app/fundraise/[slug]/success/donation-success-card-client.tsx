'use client'

import { useRouter } from 'next/navigation'
import { DonationSuccessCard } from '@/components/fundraiser/donation-success-card'

export interface DonationSuccessCardClientProps {
  amount: number
  donorEmail: string | null
  dismissHref: string
}

/**
 * Client wrapper so the Dismiss button can navigate back to the team page.
 * Page stays a server component for SEO / metadata.
 */
export function DonationSuccessCardClient({
  amount,
  donorEmail,
  dismissHref,
}: DonationSuccessCardClientProps) {
  const router = useRouter()
  return (
    <DonationSuccessCard
      amount={amount}
      donorEmail={donorEmail}
      onDismiss={() => router.push(dismissHref)}
    />
  )
}
