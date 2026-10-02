'use client'

import { useState } from 'react'
import { FeedsTabs } from './feeds-tabs'
import { ProductFeeds } from './product-feeds'
import { SocialShops } from './social-shops'
import { FeedsLive } from './feeds-live'
import type { FeedsTab } from '@/types/feeds'
import type { SocialAccountInfo } from '@/types/social'

type Props = {
  accounts: SocialAccountInfo[]
  syncProviderStatus: { AMAZON: boolean; GOOGLE_SHOPPING: boolean; TIKTOK_SHOP: boolean }
  initialTab?: FeedsTab
}

export function FeedsDashboardClient({ accounts, syncProviderStatus, initialTab = 'feeds' }: Props) {
  const [activeTab, setActiveTab] = useState<FeedsTab>(initialTab)

  return (
    <div className="space-y-6">
      <FeedsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'feeds' && <ProductFeeds />}

      {activeTab === 'shops' && (
        <SocialShops accounts={accounts} syncProviderStatus={syncProviderStatus} />
      )}

      {activeTab === 'live' && <FeedsLive />}
    </div>
  )
}
