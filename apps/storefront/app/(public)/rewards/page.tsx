import type { Metadata } from 'next'
import Link from 'next/link'
import { Gift, ShoppingBag, TrendingUp } from 'lucide-react'
import type { LoyaltyTier } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createMetadata } from '@/lib/metadata'
import { prisma } from '@/lib/prisma'
import { POINTS_PER_DOLLAR, TIER_THRESHOLDS } from '@/lib/loyalty-rules'
import { LOYALTY_TIERS, hasRedemptionsLeft, tierLabel } from '@/lib/loyalty-progress'
import { formatPrice } from '@/lib/utils'
import { RewardsStatusPanel } from './rewards-status-panel'

export const revalidate = 3600

export const metadata: Metadata = createMetadata({
  title: 'Salsa Rewards Program',
  description: `Earn ${POINTS_PER_DOLLAR} points for every $1 you spend on Jose Madrid Salsa, climb from Bronze to Platinum, and trade points for money off your next order.`,
  pathname: '/rewards',
})

const steps = [
  {
    icon: ShoppingBag,
    title: 'Shop signed in',
    description: `Every $1 you spend on salsa earns ${POINTS_PER_DOLLAR} points. Points post to your account as soon as your payment goes through.`,
  },
  {
    icon: TrendingUp,
    title: 'Climb the tiers',
    description: 'Your tier follows the points you have earned over time, so spending points never moves you down. Higher tiers unlock bigger rewards.',
  },
  {
    icon: Gift,
    title: 'Redeem for money off',
    description: 'Trade points for a one-time discount code from your account page, then enter it at checkout.',
  },
]

async function getActiveRewards() {
  try {
    const rewards = await prisma.loyaltyReward.findMany({
      where: { isActive: true, rewardType: 'DISCOUNT' },
      orderBy: { pointsCost: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        pointsCost: true,
        rewardValue: true,
        minimumTier: true,
        maxRedemptions: true,
        usedCount: true,
      },
    })
    return rewards.filter(hasRedemptionsLeft)
  } catch (error) {
    // A build without a database still renders the program; the catalog fills in on revalidate.
    console.warn('Rewards catalog unavailable:', error instanceof Error ? error.message : 'Unknown error')
    return []
  }
}

export default async function RewardsPage() {
  const rewards = await getActiveRewards()
  const unlocksByTier = new Map<LoyaltyTier, string[]>()
  for (const reward of rewards) {
    unlocksByTier.set(reward.minimumTier, [...(unlocksByTier.get(reward.minimumTier) ?? []), reward.name])
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="relative bg-gradient-to-r from-salsa-600 via-chile-600 to-verde-600 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <h1 className="text-4xl font-serif font-bold text-shadow-lg lg:text-6xl">Salsa Rewards</h1>
            <p className="mt-6 max-w-xl text-xl leading-relaxed text-salsa-100">
              Earn {POINTS_PER_DOLLAR} points for every $1 you spend and turn them into money off your next order of
              Jose Madrid Salsa.
            </p>
          </div>
          <RewardsStatusPanel />
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-10 text-center text-3xl font-serif font-bold text-foreground lg:text-4xl">How it works</h2>
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <Card key={title} className="card surface-shadow">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-salsa-500 to-chile-500">
                    <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {index + 1}. {title}
                  </h3>
                  <p className="mt-2 text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {rewards.length > 0 && (
        <section className="bg-muted/40 py-16">
          <div className="container mx-auto px-4">
            <h2 className="mb-3 text-center text-3xl font-serif font-bold text-foreground lg:text-4xl">Rewards you can redeem</h2>
            <p className="mb-10 text-center text-muted-foreground">Each code works once and is good for 90 days.</p>
            <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rewards.map((reward) => (
                <Card key={reward.id} className="card surface-shadow">
                  <CardContent className="p-6">
                    <p className="text-3xl font-bold text-salsa-600">
                      {reward.rewardValue ? formatPrice(Number(reward.rewardValue)) : reward.name}
                    </p>
                    <p className="mt-1 font-semibold text-foreground">{reward.name}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{reward.description}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium tabular-nums">{reward.pointsCost.toLocaleString()} points</span>
                      <span className="text-muted-foreground">{tierLabel(reward.minimumTier)} and up</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-10 text-center text-3xl font-serif font-bold text-foreground lg:text-4xl">Tiers</h2>
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LOYALTY_TIERS.map((tier) => {
              const unlocks = unlocksByTier.get(tier) ?? []
              return (
                <div key={tier} className="rounded-lg border bg-card p-5">
                  <p className="text-lg font-semibold text-foreground">{tierLabel(tier)}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {TIER_THRESHOLDS[tier] === 0
                      ? 'Where everyone starts'
                      : `${TIER_THRESHOLDS[tier].toLocaleString()} lifetime points`}
                  </p>
                  {unlocks.length > 0 && (
                    <p className="mt-3 text-sm text-foreground">Unlocks {unlocks.join(', ')}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-muted/40 py-16">
        <div className="container mx-auto max-w-3xl px-4">
          <h2 className="mb-8 text-center text-3xl font-serif font-bold text-foreground lg:text-4xl">Good to know</h2>
          <dl className="space-y-6">
            <div>
              <dt className="font-semibold text-foreground">Do guest orders earn points?</dt>
              <dd className="mt-1 text-muted-foreground">
                No. Points are saved to a customer account, so sign in before you check out. Creating an account is free.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">What counts toward points?</dt>
              <dd className="mt-1 text-muted-foreground">
                The products in your order after any discount. Shipping and sales tax do not earn points.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">Where do I see my points?</dt>
              <dd className="mt-1 text-muted-foreground">
                On your <Link href="/account/rewards" className="text-primary hover:underline">rewards page</Link>, along
                with your tier, recent activity and any reward codes you have redeemed.
              </dd>
            </div>
          </dl>
          <div className="mt-10 text-center">
            <Button size="lg" asChild>
              <Link href="/salsas">Shop salsa</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
