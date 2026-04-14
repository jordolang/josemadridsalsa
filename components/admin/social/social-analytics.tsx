'use client'

import { useMemo } from 'react'
import {
  Facebook,
  Instagram,
  Twitter,
  Music2,
  Store,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Users,
  MousePointerClick,
  TrendingUp,
  BarChart3,
} from 'lucide-react'
import type { SocialMediaPlatform } from '@prisma/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PlatformMetrics } from '@/types/social'

const PLATFORM_ICONS: Record<SocialMediaPlatform, React.ElementType> = {
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  TWITTER: Twitter,
  TIKTOK: Music2,
  GOOGLE_MY_BUSINESS: Store,
}

const PLATFORM_LABELS: Record<SocialMediaPlatform, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TWITTER: 'X (Twitter)',
  TIKTOK: 'TikTok',
  GOOGLE_MY_BUSINESS: 'Google Business',
}

const PLATFORM_BG: Record<SocialMediaPlatform, string> = {
  FACEBOOK: 'from-blue-500 to-blue-600',
  INSTAGRAM: 'from-pink-500 to-purple-600',
  TWITTER: 'from-muted-foreground to-foreground',
  TIKTOK: 'from-muted-foreground to-black',
  GOOGLE_MY_BUSINESS: 'from-blue-400 to-blue-500',
}

type Props = {
  metrics: PlatformMetrics[]
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

export function SocialAnalytics({ metrics }: Props) {
  const totals = useMemo(() => {
    return metrics.reduce(
      (acc, m) => ({
        posts: acc.posts + m.totalPosts,
        likes: acc.likes + m.totalLikes,
        comments: acc.comments + m.totalComments,
        shares: acc.shares + m.totalShares,
        impressions: acc.impressions + m.totalImpressions,
        reach: acc.reach + m.totalReach,
        clicks: acc.clicks + m.totalClicks,
      }),
      { posts: 0, likes: 0, comments: 0, shares: 0, impressions: 0, reach: 0, clicks: 0 },
    )
  }, [metrics])

  const overallEngagement = totals.impressions > 0
    ? ((totals.likes + totals.comments + totals.shares) / totals.impressions) * 100
    : 0

  const STAT_CARDS = [
    { label: 'Total Posts', value: totals.posts, icon: BarChart3, color: 'text-primary' },
    { label: 'Total Reach', value: formatNumber(totals.reach), icon: Users, color: 'text-primary' },
    { label: 'Impressions', value: formatNumber(totals.impressions), icon: Eye, color: 'text-purple-500' },
    { label: 'Engagement', value: `${overallEngagement.toFixed(1)}%`, icon: TrendingUp, color: 'text-primary' },
    { label: 'Likes', value: formatNumber(totals.likes), icon: Heart, color: 'text-destructive' },
    { label: 'Comments', value: formatNumber(totals.comments), icon: MessageCircle, color: 'text-amber-500' },
    { label: 'Shares', value: formatNumber(totals.shares), icon: Share2, color: 'text-indigo-500' },
    { label: 'Clicks', value: formatNumber(totals.clicks), icon: MousePointerClick, color: 'text-cyan-500' },
  ]

  if (metrics.length === 0 || totals.posts === 0) {
    return (
      <Card className="flex flex-col items-center p-12 text-center">
        <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/60" />
        <h3 className="text-lg font-semibold text-foreground">No analytics data yet</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Publish posts to your connected social accounts and analytics will appear here.
          Engagement metrics are pulled from each platform automatically after publishing.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="flex items-center gap-4 p-5">
              <div className={cn('rounded-xl bg-muted p-3', stat.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Per-platform breakdown */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics
          .filter((m) => m.totalPosts > 0)
          .sort((a, b) => b.totalImpressions - a.totalImpressions)
          .map((m) => {
            const Icon = PLATFORM_ICONS[m.platform]
            const gradient = PLATFORM_BG[m.platform]
            return (
              <Card key={m.platform} className="overflow-hidden">
                {/* Platform header */}
                <div className={cn('bg-gradient-to-r p-5 text-white', gradient)}>
                  <div className="flex items-center gap-3">
                    <Icon className="h-6 w-6" />
                    <div>
                      <p className="font-semibold">{PLATFORM_LABELS[m.platform]}</p>
                      <p className="text-sm opacity-80">{m.totalPosts} posts</p>
                    </div>
                  </div>
                  <p className="mt-3 text-3xl font-bold">{formatNumber(m.totalImpressions)}</p>
                  <p className="text-sm opacity-80">impressions</p>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-3 gap-px bg-muted">
                  <MetricCell icon={Heart} label="Likes" value={formatNumber(m.totalLikes)} />
                  <MetricCell icon={MessageCircle} label="Comments" value={formatNumber(m.totalComments)} />
                  <MetricCell icon={Share2} label="Shares" value={formatNumber(m.totalShares)} />
                  <MetricCell icon={Users} label="Reach" value={formatNumber(m.totalReach)} />
                  <MetricCell icon={MousePointerClick} label="Clicks" value={formatNumber(m.totalClicks)} />
                  <MetricCell
                    icon={TrendingUp}
                    label="Engagement"
                    value={`${m.engagementRate.toFixed(1)}%`}
                    highlight
                  />
                </div>
              </Card>
            )
          })}
      </div>

      {/* Engagement comparison bar chart (CSS-only) */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground">Engagement Rate by Platform</h3>
        <p className="text-sm text-muted-foreground">Percentage of impressions that resulted in interactions</p>
        <div className="mt-4 space-y-3">
          {metrics
            .filter((m) => m.totalPosts > 0)
            .sort((a, b) => b.engagementRate - a.engagementRate)
            .map((m) => {
              const Icon = PLATFORM_ICONS[m.platform]
              const maxRate = Math.max(...metrics.map((x) => x.engagementRate), 1)
              const pct = (m.engagementRate / maxRate) * 100
              return (
                <div key={m.platform} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Icon className="h-4 w-4" />
                      {PLATFORM_LABELS[m.platform]}
                    </span>
                    <span className="font-semibold text-foreground">{m.engagementRate.toFixed(2)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full bg-gradient-to-r transition-all', PLATFORM_BG[m.platform])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
        </div>
      </Card>
    </div>
  )
}

function MetricCell({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ElementType
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className={cn('bg-card p-3 text-center', highlight && 'bg-primary/5')}>
      <Icon className="mx-auto h-4 w-4 text-muted-foreground" />
      <p className={cn('mt-1 text-lg font-bold', highlight ? 'text-primary' : 'text-foreground')}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}
