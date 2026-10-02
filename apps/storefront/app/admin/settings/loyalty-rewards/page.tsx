import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { POINTS_PER_DOLLAR } from '@/lib/loyalty'
import { LoyaltyRewardsManager, type RewardRow } from './_components/loyalty-rewards-manager'

async function getRewards(): Promise<RewardRow[]> {
  const rewards = await prisma.loyaltyReward.findMany({
    orderBy: [{ isActive: 'desc' }, { pointsCost: 'asc' }],
    include: { _count: { select: { redemptions: true } } },
  })
  return rewards.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    pointsCost: r.pointsCost,
    rewardValue: r.rewardValue ? Number(r.rewardValue) : 0,
    rewardType: r.rewardType,
    minimumTier: r.minimumTier,
    maxRedemptions: r.maxRedemptions,
    usedCount: r.usedCount,
    redemptionCount: r._count.redemptions,
    isActive: r.isActive,
  }))
}

export default async function LoyaltyRewardsPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'settings:read'))) {
    redirect('/admin')
  }

  const [canWrite, rewards, members] = await Promise.all([
    hasPermission(user, 'settings:write'),
    getRewards(),
    prisma.loyaltyAccount.count(),
  ])

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Loyalty Rewards</h1>
        <p className="text-muted-foreground mt-1">
          What customers can spend points on. Customers earn {POINTS_PER_DOLLAR} points per $1 of merchandise;
          redeeming a reward issues a single-use discount code. {members.toLocaleString()} loyalty member
          {members === 1 ? '' : 's'} so far.
        </p>
      </div>

      <LoyaltyRewardsManager rewards={rewards} canWrite={canWrite} pointsPerDollar={POINTS_PER_DOLLAR} />
    </div>
  )
}
