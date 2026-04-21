import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Swords } from 'lucide-react'
import { DonationSuccessCardClient } from './donation-success-card-client'
import { prisma as db } from '@/lib/prisma'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    amount?: string
    email?: string
    kind?: string
  }>
}

export default async function FundraiserSuccessPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params
  const { amount, email, kind } = await searchParams
  const parsed = Number(amount)
  if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
    redirect(`/fundraise/${slug}`)
  }

  // Lightweight team lookup so we can link back to the battle tab. Missing
  // team (edge case from a deleted slug) just falls through to the card.
  const team = await db.fundraiserTeam.findUnique({
    where: { slug },
    select: {
      name: true,
      activePeriod: true,
      teamColor: true,
    },
  })

  const isShop = kind === 'shop'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <DonationSuccessCardClient
        amount={parsed}
        donorEmail={email ?? null}
        dismissHref={`/fundraise/${slug}`}
      />
      {team && team.activePeriod && (
        <div
          className="w-full max-w-md rounded-2xl border bg-white p-4 text-center shadow-sm"
          style={{ borderColor: `${team.teamColor}66` }}
        >
          <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-600">
            <Swords className="h-4 w-4" />
            Arena impact
          </div>
          <p className="mt-2 text-sm text-slate-700">
            {isShop
              ? `Your purchase just struck every rival team for `
              : `Your donation just damaged every rival team for `}
            <span className="font-bold tabular-nums">
              ${parsed.toFixed(2)}
            </span>{' '}
            in the {team.activePeriod} Battle Arena.
          </p>
          <Link
            href={`/arena/${team.activePeriod}`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Watch the leaderboard update
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </main>
  )
}
