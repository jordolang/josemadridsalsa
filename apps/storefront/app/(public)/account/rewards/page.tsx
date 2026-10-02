import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createMetadata } from "@/lib/metadata";
import { POINTS_PER_DOLLAR } from "@/lib/loyalty";
import { RedeemRewardButton } from "./redeem-reward-button";

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  ...createMetadata({
    title: "Loyalty Rewards - Jose Madrid Salsa",
    description: "Check your Jose Madrid Salsa loyalty points balance, tier, and redeem points for discount codes.",
    pathname: "/account/rewards",
  }),
  robots: { index: false },
};

const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];

export default async function RewardsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/account/rewards");
  }
  const userId = (session.user as { id: string }).id;

  const [account, rewards] = await Promise.all([
    prisma.loyaltyAccount.findUnique({
      where: { userId },
      include: {
        transactions: { orderBy: { createdAt: "desc" }, take: 10 },
        rewards: {
          where: { status: "ACTIVE", discountCode: { not: null } },
          orderBy: { createdAt: "desc" },
          include: { reward: { select: { name: true } } },
        },
      },
    }),
    prisma.loyaltyReward.findMany({
      where: { isActive: true, rewardType: "DISCOUNT" },
      orderBy: { pointsCost: "asc" },
    }),
  ]);

  const balance = account?.pointsBalance ?? 0;
  const tier = account?.tier ?? "BRONZE";
  const now = new Date();
  const codes = (account?.rewards ?? []).filter((r) => !r.expiresAt || r.expiresAt > now);

  return (
    <div className="grid gap-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Loyalty Rewards</h1>
            <p className="text-sm text-muted-foreground">
              Earn {POINTS_PER_DOLLAR} points for every $1 you spend on salsa.
            </p>
          </div>
          <Badge variant="outline" className="text-sm">{tier} tier</Badge>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Points balance</p>
            <p className="text-3xl font-bold tabular-nums">{balance.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lifetime points</p>
            <p className="text-3xl font-bold tabular-nums">{(account?.lifetimePoints ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </Card>

      {codes.length > 0 && (
        <Card className="p-4">
          <h2 className="text-lg font-medium mb-3">Your reward codes</h2>
          <p className="text-sm text-muted-foreground mb-3">Enter a code at checkout. Each code works once.</p>
          <div className="grid gap-2">
            {codes.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="font-mono font-semibold">{r.discountCode}</p>
                  <p className="text-xs text-muted-foreground">{r.reward.name}</p>
                </div>
                {r.expiresAt && (
                  <p className="text-xs text-muted-foreground">Expires {r.expiresAt.toLocaleDateString()}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">Redeem points</h2>
        {rewards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rewards are available right now. Your points will keep adding up.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rewards.map((reward) => {
              const tierLocked = TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(reward.minimumTier);
              const shortBy = reward.pointsCost - balance;
              const reason = tierLocked
                ? `Requires ${reward.minimumTier} tier`
                : shortBy > 0
                  ? `${shortBy.toLocaleString()} more points needed`
                  : null;
              return (
                <div key={reward.id} className="rounded-lg border p-4">
                  <p className="font-semibold">{reward.name}</p>
                  <p className="text-sm text-muted-foreground">{reward.description}</p>
                  <p className="mt-2 text-sm font-medium tabular-nums">{reward.pointsCost.toLocaleString()} points</p>
                  <div className="mt-3">
                    <RedeemRewardButton rewardId={reward.id} disabledReason={reason} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium mb-3">Recent activity</h2>
        {(account?.transactions.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No points yet. <Link href="/products" className="text-primary hover:underline">Shop salsa</Link> to start earning.
          </p>
        ) : (
          <div className="grid gap-2">
            {account!.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <div>
                  <p>{t.description}</p>
                  <p className="text-xs text-muted-foreground">{t.createdAt.toLocaleDateString()}</p>
                </div>
                <span className={t.points >= 0 ? "font-medium text-green-700" : "font-medium text-red-700"}>
                  {t.points >= 0 ? "+" : ""}{t.points.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
