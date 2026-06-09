'use client'

import { LayoutDashboard, PenSquare, CalendarDays, Link2, BarChart3, ShoppingBag } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DashboardTab } from '@/types/social'

const TABS: Array<{ id: DashboardTab; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'compose', label: 'Compose', icon: PenSquare },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'accounts', label: 'Accounts', icon: Link2 },
  { id: 'shops', label: 'Shops', icon: ShoppingBag },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
]

type Props = {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
}

export function SocialDashboardTabs({ activeTab, onTabChange }: Props) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as DashboardTab)}
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
