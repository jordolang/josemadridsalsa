'use client'

import { useRouter } from 'next/navigation'
import { DonationForm } from '@/components/fundraiser/donation-form'

export interface FundraiserCheckoutPanelProps {
  teamId: string
  teamSlug: string
  teamName: string
  pricePerUnit: number
}

/**
 * Bridge between the read-only FundraiserProfilePage server component and
 * the interactive DonationForm. Normalizes the amount into a jar count and
 * forwards to the shop with the team ref attached.
 */
export function FundraiserCheckoutPanel({
  teamId,
  teamSlug,
  teamName,
  pricePerUnit,
}: FundraiserCheckoutPanelProps) {
  const router = useRouter()

  return (
    <DonationForm
      tiers={[
        { amount: 100, label: `~${Math.max(1, Math.round(100 / pricePerUnit))} jars of salsa` },
        { amount: 50, label: `~${Math.max(1, Math.round(50 / pricePerUnit))} jars of salsa` },
        { amount: 25, label: `~${Math.max(1, Math.round(25 / pricePerUnit))} jars of salsa` },
        { amount: 10, label: 'Every bit helps' },
      ]}
      onSubmit={({ amount, frequency, fundId }) => {
        const params = new URLSearchParams({
          ref: teamSlug,
          team: teamId,
          amount: String(amount),
          frequency,
        })
        if (fundId) params.set('fund', fundId)
        router.push(`/shop?${params.toString()}`)
      }}
    />
  )
}
