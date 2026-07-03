'use client'

import { Radio, Rss, ShoppingBag } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { FeedsTab } from '@/types/feeds'

const TABS: Array<{ id: FeedsTab; label: string; icon: React.ElementType }> = [
  { id: 'feeds', label: 'Product Feeds', icon: Rss },
  { id: 'shops', label: 'Shops', icon: ShoppingBag },
  { id: 'live', label: 'Live', icon: Radio },
]

type Props = {
  activeTab: FeedsTab
  onTabChange: (tab: FeedsTab) => void
}

export function FeedsTabs({ activeTab, onTabChange }: Props) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as FeedsTab)}
    >
      <TabsList>
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
