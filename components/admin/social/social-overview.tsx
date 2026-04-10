'use client'

import { Facebook, Instagram, Twitter, Music2, Store, TrendingUp, Clock, Send, AlertCircle, CheckCircle2, FileText, BarChart3, PenSquare } from 'lucide-react'
import type { SocialMediaPlatform, SocialMediaPostStatus } from '@prisma/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SocialAccountInfo, DashboardTab } from '@/types/social'

const PLATFORM_ICONS: Record<SocialMediaPlatform, React.ElementType> = {
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  TWITTER: Twitter,
  TIKTOK: Music2,
  GOOGLE_MY_BUSINESS: Store,
}

const PLATFORM_COLORS: Record<SocialMediaPlatform, { bg: string; text: string; border: string }> = {
  FACEBOOK: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  INSTAGRAM: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
  TWITTER: { bg: 'bg-muted/50', text: 'text-foreground', border: 'border-border' },
  TIKTOK: { bg: 'bg-muted/50', text: 'text-foreground', border: 'border-border' },
  GOOGLE_MY_BUSINESS: { bg: 'bg-blue-50', text: 'text-blue-500', border: 'border-blue-200' },
}

const PLATFORM_LABELS: Record<SocialMediaPlatform, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TWITTER: 'X (Twitter)',
  TIKTOK: 'TikTok',
  GOOGLE_MY_BUSINESS: 'Google Business',
}

const STATUS_CONFIG: Record<SocialMediaPostStatus, { icon: React.ElementType; color: string; label: string }> = {
  DRAFT: { icon: FileText, color: 'text-muted-foreground', label: 'Drafts' },
  SCHEDULED: { icon: Clock, color: 'text-blue-500', label: 'Scheduled' },
  PUBLISHED: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Published' },
  FAILED: { icon: AlertCircle, color: 'text-destructive', label: 'Failed' },
}

type StatusCount = { status: SocialMediaPostStatus; count: number }

type Props = {
  accounts: SocialAccountInfo[]
  statusCounts: StatusCount[]
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
  onNavigate: (tab: DashboardTab) => void
}

export function SocialOverview({
  accounts,
  statusCounts,
  platformFrequency,
  recentPosts,
  scheduledPosts,
  onNavigate,
}: Props) {
  const totalPosts = statusCounts.reduce((sum, s) => sum + s.count, 0)
  const connectedCount = accounts.length

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.entries(STATUS_CONFIG) as [SocialMediaPostStatus, typeof STATUS_CONFIG[SocialMediaPostStatus]][]).map(
          ([status, config]) => {
            const count = statusCounts.find((s) => s.status === status)?.count ?? 0
            const Icon = config.icon
            return (
              <Card key={status} className="flex items-center gap-4 p-5">
                <div className={cn('rounded-xl bg-muted p-3', config.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{config.label}</p>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                </div>
              </Card>
            )
          },
        )}
      </div>

      {/* Connected accounts strip */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Connected Accounts</h3>
            <p className="text-sm text-muted-foreground">
              {connectedCount} platform{connectedCount !== 1 ? 's' : ''} connected
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onNavigate('accounts')}>
            Manage
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(['FACEBOOK', 'INSTAGRAM', 'TWITTER', 'TIKTOK', 'GOOGLE_MY_BUSINESS'] as SocialMediaPlatform[]).map(
            (platform) => {
              const account = accounts.find((a) => a.platform === platform)
              const Icon = PLATFORM_ICONS[platform]
              const colors = PLATFORM_COLORS[platform]
              const isConnected = Boolean(account)

              return (
                <div
                  key={platform}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 transition',
                    isConnected ? colors.border : 'border-dashed border-input',
                    isConnected ? colors.bg : 'bg-muted/50/50',
                  )}
                >
                  <div className={cn('rounded-lg p-2', isConnected ? colors.text : 'text-muted-foreground')}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {PLATFORM_LABELS[platform]}
                    </p>
                    {isConnected ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {account!.accountHandle || account!.accountName}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not connected</p>
                    )}
                  </div>
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full',
                      isConnected ? 'bg-emerald-400' : 'bg-muted',
                    )}
                  />
                </div>
              )
            },
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Upcoming scheduled posts */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Upcoming Posts</h3>
              <p className="text-sm text-muted-foreground">Scheduled content queue</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('calendar')}>
              View calendar
            </Button>
          </div>
          {scheduledPosts.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Clock className="mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">No posts scheduled</p>
              <Button size="sm" className="mt-3" onClick={() => onNavigate('compose')}>
                Create a post
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {scheduledPosts.slice(0, 5).map((post) => (
                <div
                  key={post.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-muted/50/50 p-3"
                >
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-foreground">{post.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {post.platforms.map((p) => {
                        const PIcon = PLATFORM_ICONS[p]
                        return (
                          <span key={p} className={cn('inline-flex items-center gap-1 text-xs', PLATFORM_COLORS[p].text)}>
                            <PIcon className="h-3 w-3" />
                            {PLATFORM_LABELS[p]}
                          </span>
                        )
                      })}
                      {post.scheduledAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(post.scheduledAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Platform activity */}
        <Card className="p-5">
          <h3 className="font-semibold text-foreground">Platform Activity</h3>
          <p className="text-sm text-muted-foreground">Posts by platform</p>
          {Object.keys(platformFrequency).length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">No posts yet</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {Object.entries(platformFrequency)
                .sort((a, b) => b[1] - a[1])
                .map(([platform, count]) => {
                  const p = platform as SocialMediaPlatform
                  const Icon = PLATFORM_ICONS[p]
                  const max = Math.max(...Object.values(platformFrequency))
                  const pct = max > 0 ? (count / max) * 100 : 0
                  return (
                    <div key={platform} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium text-foreground">
                          {Icon && <Icon className="h-4 w-4" />}
                          {PLATFORM_LABELS[p] || platform}
                        </span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-salsa-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </Card>
      </div>

      {/* Recent posts table */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="font-semibold text-foreground">Recent Posts</h3>
            <p className="text-sm text-muted-foreground">Latest activity across all platforms</p>
          </div>
          <Button size="sm" onClick={() => onNavigate('compose')}>
            <PenSquare className="mr-2 h-4 w-4" />
            New Post
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Content</th>
                <th className="px-5 py-3 text-left font-medium">Platforms</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {recentPosts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground">
                    No posts created yet. Start composing!
                  </td>
                </tr>
              ) : (
                recentPosts.slice(0, 10).map((post) => (
                  <tr key={post.id} className="border-b last:border-0 hover:bg-muted/50/50">
                    <td className="max-w-xs px-5 py-3">
                      <p className="line-clamp-2 text-foreground">{post.content}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        {post.platforms.map((p) => {
                          const PIcon = PLATFORM_ICONS[p]
                          return (
                            <span
                              key={p}
                              className={cn('rounded-md p-1.5', PLATFORM_COLORS[p].bg, PLATFORM_COLORS[p].text)}
                              title={PLATFORM_LABELS[p]}
                            >
                              <PIcon className="h-3.5 w-3.5" />
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        className={cn(
                          'text-xs',
                          post.status === 'PUBLISHED' && 'bg-emerald-100 text-emerald-700',
                          post.status === 'SCHEDULED' && 'bg-blue-100 text-blue-700',
                          post.status === 'DRAFT' && 'bg-muted text-muted-foreground',
                          post.status === 'FAILED' && 'bg-destructive/10 text-destructive',
                        )}
                      >
                        {post.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                      {new Date(post.publishedAt || post.scheduledAt || post.createdAt).toLocaleDateString(
                        undefined,
                        { month: 'short', day: 'numeric', year: 'numeric' },
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
