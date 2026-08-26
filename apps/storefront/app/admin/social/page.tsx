import { redirect } from 'next/navigation'
import type { SocialMediaPlatform, SocialMediaPostStatus } from '@prisma/client'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { SocialDashboardClient } from '@/components/admin/social/social-dashboard-client'
import { getPlatformConfigStatus } from '@/lib/social/config'
import { createSocialPost } from './actions'
import type { SocialAccountInfo, CalendarPost, PlatformMetrics, DashboardTab } from '@/types/social'

async function getSocialMediaData() {
  let recentPosts: Awaited<ReturnType<typeof prisma.socialMediaPost.findMany>> = []
  let scheduledPosts: typeof recentPosts = []
  let statusCounts: Array<{ status: SocialMediaPostStatus; _count: { _all: number } }> = []
  let allPosts: Array<{ id: string; content: string; platforms: SocialMediaPlatform[]; status: SocialMediaPostStatus; scheduledAt: Date | null; publishedAt: Date | null }> = []

  try {
    ;[recentPosts, scheduledPosts, statusCounts, allPosts] = await Promise.all([
      prisma.socialMediaPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.socialMediaPost.findMany({
        where: { status: 'SCHEDULED' },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
      }),
      prisma.socialMediaPost.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      // For calendar - get posts from the last 90 days and future scheduled
      prisma.socialMediaPost.findMany({
        where: {
          OR: [
            { createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
            { scheduledAt: { gte: new Date() } },
          ],
        },
        select: {
          id: true,
          content: true,
          platforms: true,
          status: true,
          scheduledAt: true,
          publishedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])
  } catch (error) {
    console.warn('[SOCIAL] Failed to fetch social media posts:', error instanceof Error ? error.message : error)
  }

  // Get connected accounts
  let accounts: SocialAccountInfo[] = []
  try {
    const rawAccounts = await prisma.socialAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    accounts = rawAccounts.map((a) => ({
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
    console.warn('[SOCIAL] SocialAccount table not yet available')
  }

  // Get publish metrics
  let metrics: PlatformMetrics[] = []
  try {
    const publishes = await prisma.socialPostPublish.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        platform: true,
        likes: true,
        comments: true,
        shares: true,
        impressions: true,
        reach: true,
        clicks: true,
      },
    })

    const metricsMap: Record<string, PlatformMetrics> = {}
    for (const p of publishes) {
      if (!metricsMap[p.platform]) {
        metricsMap[p.platform] = {
          platform: p.platform,
          totalPosts: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalImpressions: 0,
          totalReach: 0,
          totalClicks: 0,
          engagementRate: 0,
        }
      }
      const m = metricsMap[p.platform]
      m.totalPosts++
      m.totalLikes += p.likes
      m.totalComments += p.comments
      m.totalShares += p.shares
      m.totalImpressions += p.impressions
      m.totalReach += p.reach
      m.totalClicks += p.clicks
    }

    metrics = Object.values(metricsMap).map((m) => ({
      ...m,
      engagementRate:
        m.totalImpressions > 0
          ? ((m.totalLikes + m.totalComments + m.totalShares) / m.totalImpressions) * 100
          : 0,
    }))
  } catch {
    console.warn('[SOCIAL] SocialPostPublish table not yet available')
  }

  const platformFrequency = recentPosts.reduce<Record<string, number>>((acc, post) => {
    post.platforms.forEach((platform) => {
      acc[platform] = (acc[platform] || 0) + 1
    })
    return acc
  }, {})

  const calendarPosts: CalendarPost[] = allPosts
    .filter((p) => p.scheduledAt || p.publishedAt)
    .map((p) => ({
      id: p.id,
      content: p.content,
      platforms: p.platforms,
      status: p.status,
      scheduledAt: (p.scheduledAt || p.publishedAt)!.toISOString(),
      publishedAt: p.publishedAt?.toISOString() ?? null,
    }))

  return {
    recentPosts: recentPosts.map((p) => ({
      id: p.id,
      content: p.content,
      platforms: p.platforms,
      status: p.status,
      scheduledAt: p.scheduledAt?.toISOString() ?? null,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    scheduledPosts: scheduledPosts.map((p) => ({
      id: p.id,
      content: p.content,
      platforms: p.platforms,
      scheduledAt: p.scheduledAt?.toISOString() ?? null,
    })),
    statusCounts: statusCounts.map((item) => ({
      status: item.status,
      count: item._count._all,
    })),
    platformFrequency,
    accounts,
    calendarPosts,
    metrics,
  }
}

export default async function SocialMediaPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string
    connected?: string
    igAccounts?: string
    notice?: string
    error?: string
    /** Prefilled composer body, e.g. from the Events week grid's Share menu. */
    content?: string
  }>
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'social_media:compose'))) {
    redirect('/admin')
  }

  const canPublish = await hasPermission(user, 'social_media:publish')
  const canSchedule = await hasPermission(user, 'social_media:schedule')

  const {
    recentPosts,
    scheduledPosts,
    statusCounts,
    platformFrequency,
    accounts,
    calendarPosts,
    metrics,
  } = await getSocialMediaData()

  const platformConfig = await getPlatformConfigStatus()

  const params = await searchParams
  // Shops moved to the Feeds section — keep old deep links working.
  if (params.tab === 'shops') {
    redirect('/admin/feeds?tab=shops')
  }
  // A prefilled body only makes sense on the composer, so it selects that tab.
  const composePrefill = params.content?.slice(0, 2000)
  const initialTab = (params.tab as DashboardTab) || (composePrefill ? 'compose' : 'overview')
  const connectedPlatform = params.connected
  const linkedInstagramCount = params.igAccounts ? Number(params.igAccounts) : 0
  const noticeMessage = params.notice
  const errorMessage = params.error

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Social Media</h1>
          <p className="text-sm text-muted-foreground">
            Manage content across Facebook, X, TikTok, Instagram & Google
            Business. Shop catalogs and product feeds live under Feeds.
          </p>
        </div>
        {(canSchedule || canPublish) && (
          <Badge variant="default" className="gap-1.5 px-3 py-1">
            <span className="size-1.5 rounded-full bg-current" />
            Full publishing access enabled
          </Badge>
        )}
      </div>

      {/* Connection success banner */}
      {connectedPlatform && (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>
            Successfully connected {connectedPlatform}! You can now publish
            directly to this platform.
            {linkedInstagramCount > 0 && connectedPlatform !== 'instagram' && (
              <>
                {' '}
                We also linked {linkedInstagramCount} Instagram{' '}
                {linkedInstagramCount === 1 ? 'account' : 'accounts'}.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Notice banner — honest, non-error feedback (e.g. Facebook connected but
          no Instagram Business account found, or publish permission missing). */}
      {noticeMessage && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200 [&>svg]:text-amber-600">
          <AlertTriangle className="size-4" />
          <AlertDescription>{decodeURIComponent(noticeMessage)}</AlertDescription>
        </Alert>
      )}

      {/* Error banner */}
      {errorMessage && (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertDescription>
            Connection error: {decodeURIComponent(errorMessage)}
          </AlertDescription>
        </Alert>
      )}

      {/* Dashboard */}
      <SocialDashboardClient
        createPostAction={createSocialPost}
        accounts={accounts}
        platformConfig={platformConfig}
        statusCounts={statusCounts}
        platformFrequency={platformFrequency}
        recentPosts={recentPosts}
        scheduledPosts={scheduledPosts}
        calendarPosts={calendarPosts}
        metrics={metrics}
        canSchedule={canSchedule}
        canPublish={canPublish}
        initialTab={initialTab}
        initialContent={composePrefill}
      />
    </div>
  )
}
