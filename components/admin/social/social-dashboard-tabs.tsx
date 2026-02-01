'use client'

import { useState } from 'react'
import { LayoutDashboard, PenSquare, CalendarDays, Link2, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardTab } from '@/types/social'

const TABS: Array<{ id: DashboardTab; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'compose', label: 'Compose', icon: PenSquare },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'accounts', label: 'Accounts', icon: Link2 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
]

type Props = {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
}

export function SocialDashboardTabs({ activeTab, onTabChange }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
