'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import type { LoyaltyTier } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { tierLabel, tierProgress } from '@/lib/loyalty-progress'

interface AccountSummary {
  pointsBalance: number
  lifetimePoints: number
  tier: LoyaltyTier
}

/**
 * The visitor's own standing on the public rewards page. The page itself is cached and
 * shared, so the signed-in part is fetched here, in the browser, from `/api/loyalty`.
 */
export function RewardsStatusPanel() {
  const { status } = useSession()
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    fetch('/api/loyalty')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: AccountSummary } | null) => {
        if (cancelled) return
        if (body?.data) setAccount(body.data)
        else setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [status])

  if (status === 'loading') {
    return <div className="h-40 animate-pulse rounded-2xl bg-white/10" aria-hidden="true" />
  }

  if (status !== 'authenticated') {
    return (
      <div className="rounded-2xl bg-white/10 p-6 text-left backdrop-blur-sm">
        <p className="text-lg font-semibold">Start earning on your next order</p>
        <p className="mt-1 text-sm text-salsa-100">
          Points go to customer accounts, so sign in or create a free account before you check out.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button className="bg-white font-semibold text-salsa-700 hover:bg-salsa-50" asChild>
            <Link href="/auth/signup">Create an account</Link>
          </Button>
          <Button variant="outline" className="border-white bg-transparent text-white hover:bg-white/10" asChild>
            <Link href="/auth/signin?callbackUrl=/rewards">Sign in</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (failed) {
    return (
      <div className="rounded-2xl bg-white/10 p-6 text-left backdrop-blur-sm">
        <p className="text-lg font-semibold">Your points are on your account page</p>
        <Button className="mt-4 bg-white font-semibold text-salsa-700 hover:bg-salsa-50" asChild>
          <Link href="/account/rewards">View your rewards</Link>
        </Button>
      </div>
    )
  }

  if (!account) {
    return <div className="h-40 animate-pulse rounded-2xl bg-white/10" aria-hidden="true" />
  }

  const progress = tierProgress(account.lifetimePoints)

  return (
    <div className="rounded-2xl bg-white/10 p-6 text-left backdrop-blur-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-salsa-100">Your points</p>
          <p className="text-4xl font-bold tabular-nums">{account.pointsBalance.toLocaleString()}</p>
        </div>
        <p className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-salsa-700">
          {tierLabel(account.tier)} member
        </p>
      </div>
      <div className="mt-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-white/20"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          aria-label="Progress to the next tier"
        >
          <div className="h-full rounded-full bg-white" style={{ width: `${progress.percent}%` }} />
        </div>
        <p className="mt-2 text-sm text-salsa-100">
          {progress.nextTier
            ? `${progress.pointsToNextTier.toLocaleString()} more points to ${tierLabel(progress.nextTier)}`
            : 'You have reached our top tier.'}
        </p>
      </div>
      <Button className="mt-4 bg-white font-semibold text-salsa-700 hover:bg-salsa-50" asChild>
        <Link href="/account/rewards">Redeem your points</Link>
      </Button>
    </div>
  )
}
