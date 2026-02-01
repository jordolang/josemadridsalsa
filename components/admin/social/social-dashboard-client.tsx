'use client'

import { useState } from 'react'
import type { SocialMediaPlatform, SocialMediaPostStatus } from '@prisma/client'
import { SocialDashboardTabs } from './social-dashboard-tabs'
import { SocialOverview } from './social-overview'
import { SocialComposer } from './social-composer'
import { SocialCalendar } from './social-calendar'
import { SocialAccounts } from './social-accounts'
import { SocialAnalytics } from './social-analytics'
import type {
  DashboardTab,
  SocialComposerState,
  SocialAccountInfo,
  CalendarPost,
  PlatformMetrics,
} from '@/types/social'

type Props = {
  createPostAction: (state: SocialComposerState, formData: FormData) => Promise<SocialComposerState>
  accounts: SocialAccountInfo[]
  statusCounts: Array<{ status: SocialMediaPostStatus; count: number }>
  platformFrequency: Record<string, number>
  recentPosts: Array<{
    id: string
    content: string
    platforms: SocialMediaPlatform[]
    status: SocialMediaPostStatus
    scheduledAt: string | null
    publishedAt: string | null
    createdAt: string
  }>
  scheduledPosts: Array<{
    id: string
    content: string
    platforms: SocialMediaPlatform[]
    scheduledAt: string | null
  }>
  calendarPosts: CalendarPost[]
  metrics: PlatformMetrics[]
  canSchedule: boolean
  canPublish: boolean
  initialTab?: DashboardTab
}

export function SocialDashboardClient({
  createPostAction,
  accounts,
  statusCounts,
  platformFrequency,
  recentPosts,
  scheduledPosts,
  calendarPosts,
  metrics,
  canSchedule,
  canPublish,
  initialTab = 'overview',
}: Props) {
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab)

  return (
    <div className="space-y-6">
      <SocialDashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'overview' && (
        <SocialOverview
          accounts={accounts}
          statusCounts={statusCounts}
          platformFrequency={platformFrequency}
          recentPosts={recentPosts}
          scheduledPosts={scheduledPosts}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'compose' && (
        <SocialComposer
          action={createPostAction}
          accounts={accounts}
          canSchedule={canSchedule}
          canPublish={canPublish}
        />
      )}

      {activeTab === 'calendar' && (
        <SocialCalendar posts={calendarPosts} onNavigate={setActiveTab} />
      )}

      {activeTab === 'accounts' && <SocialAccounts accounts={accounts} />}

      {activeTab === 'analytics' && <SocialAnalytics metrics={metrics} />}
    </div>
  )
}
