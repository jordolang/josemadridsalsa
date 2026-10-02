import { redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { isAmazonSyncConfigured } from '@/lib/social/amazon-sp-api'
import { isGoogleShoppingSyncConfigured } from '@/lib/social/google-content-api'
import { isTikTokShopSyncConfigured } from '@/lib/social/tiktok-shop-api'
import { FeedsDashboardClient } from '@/components/admin/feeds/feeds-dashboard-client'
import type { SocialAccountInfo } from '@/types/social'
import type { FeedsTab } from '@/types/feeds'

const FEEDS_TABS: FeedsTab[] = ['feeds', 'shops', 'live']

/**
 * Connected social accounts, needed by the Shops tab to target Facebook /
 * TikTok exports at the right account.
 */
async function getAccounts(): Promise<SocialAccountInfo[]> {
  try {
    const rawAccounts = await prisma.socialAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    return rawAccounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      accountId: a.accountId,
      accountName: a.accountName,
      accountHandle: a.accountHandle,
      profileImageUrl: a.profileImageUrl,
      isActive: a.isActive,
      lastVerifiedAt: a.lastVerifiedAt?.toISOString() ?? null,
      connectionError: a.connectionError,
      scopes: a.scopes,
      tokenExpiresAt: a.tokenExpiresAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    }))
  } catch {
    // SocialAccount table might not exist yet if migration hasn't run
    console.warn('[FEEDS] SocialAccount table not yet available')
    return []
  }
}

export default async function FeedsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'social_media:compose'))) {
    redirect('/admin')
  }

  const accounts = await getAccounts()

  const params = await searchParams
  const initialTab = FEEDS_TABS.includes(params.tab as FeedsTab)
    ? (params.tab as FeedsTab)
    : 'feeds'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Feeds</h1>
        <p className="text-sm text-muted-foreground">
          Export your catalog to third-party platforms — Amazon, Google Shopping,
          Facebook, TikTok & more — and monitor the live streaming feed.
        </p>
      </div>

      <FeedsDashboardClient
        accounts={accounts}
        syncProviderStatus={{
          AMAZON: isAmazonSyncConfigured(),
          GOOGLE_SHOPPING: isGoogleShoppingSyncConfigured(),
          TIKTOK_SHOP: isTikTokShopSyncConfigured(),
        }}
        initialTab={initialTab}
      />
    </div>
  )
}
