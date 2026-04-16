import { redirect } from 'next/navigation'
import { DonationSuccessCardClient } from './donation-success-card-client'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ amount?: string; email?: string }>
}

export default async function FundraiserSuccessPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params
  const { amount, email } = await searchParams
  const parsed = Number(amount)
  if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
    redirect(`/fundraise/${slug}`)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <DonationSuccessCardClient
        amount={parsed}
        donorEmail={email ?? null}
        dismissHref={`/fundraise/${slug}`}
      />
    </main>
  )
}
