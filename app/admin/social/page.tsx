import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SocialMediaPlatform, SocialMediaPostStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { SocialDashboardClient } from '@/components/admin/social/social-dashboard-client'
import { createSocialPost } from './actions'
import type { SocialAccountInfo, CalendarPost, PlatformMetrics, DashboardTab } from '@/types/social'

async function getSocialMediaData() {
  const [recentPosts, scheduledPosts, statusCounts, allPosts] = await Promise.all([
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
  searchParams: Promise<{ tab?: string; connected?: string; error?: string }>
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

  const params = await searchParams
  const initialTab = (params.tab as DashboardTab) || 'overview'
  const connectedPlatform = params.connected
  const errorMessage = params.error

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Social Media</h1>
          <p className="text-slate-600">
            Manage, compose, schedule, and publish content across Facebook, X, TikTok, Instagram & Google Business.
          </p>
        </div>
        {(canSchedule || canPublish) && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Full publishing access enabled
          </div>
        )}
      </div>

      {/* Connection success banner */}
      {connectedPlatform && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Successfully connected {connectedPlatform}! You can now publish directly to this platform.
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Connection error: {decodeURIComponent(errorMessage)}
        </div>
      )}

      {/* Dashboard */}
      <SocialDashboardClient
        createPostAction={createSocialPost}
        accounts={accounts}
        statusCounts={statusCounts}
        platformFrequency={platformFrequency}
        recentPosts={recentPosts}
        scheduledPosts={scheduledPosts}
        calendarPosts={calendarPosts}
        metrics={metrics}
        canSchedule={canSchedule}
        canPublish={canPublish}
        initialTab={initialTab}
      />
    </div>
  )
}
