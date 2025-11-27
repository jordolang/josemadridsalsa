import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { CalendarDays, Clock, Share2, Facebook, Instagram, Store, Twitter, Music2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SocialMediaPostStatus, SocialMediaPlatform } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { logAudit } from '@/lib/audit'
import { SocialPostComposer } from '@/components/admin/social-post-composer'
import { createSocialPost } from './actions'
import type { SocialPlatformOption } from '@/types/social'
import { cn } from '@/lib/utils'

type StatusSummary = {
  status: SocialMediaPostStatus
  count: number
}

const statusStyles: Record<SocialMediaPostStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
}

const platformLabels: Record<string, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TWITTER: 'X',
  GOOGLE_MY_BUSINESS: 'Google Business',
  TIKTOK: 'TikTok',
}

const SOCIAL_PLATFORM_CONFIG: Array<{
  value: SocialMediaPlatform
  label: string
  serviceName: string
  description: string
  handle: string
  connectUrl: string
  icon: LucideIcon
}> = [
  {
    value: 'FACEBOOK',
    label: 'Facebook Page',
    serviceName: 'facebook',
    description: 'Post to the Jose Madrid Salsa Facebook community with event highlights and shareable recipes.',
    handle: process.env.NEXT_PUBLIC_FACEBOOK_HANDLE ?? '@JoseMadridSalsa',
    connectUrl: '/admin/settings/integrations?service=facebook',
    icon: Facebook,
  },
  {
    value: 'INSTAGRAM',
    label: 'Instagram',
    serviceName: 'instagram',
    description: 'Square and vertical media for stories, reels, and product spotlights.',
    handle: process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE ?? '@JoseMadridSalsa',
    connectUrl: '/admin/settings/integrations?service=instagram',
    icon: Instagram,
  },
  {
    value: 'TWITTER',
    label: 'X (Twitter)',
    serviceName: 'twitter',
    description: 'Short updates for market appearances, flash sales, and fundraiser milestones.',
    handle: process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? '@JoseMadridSalsa',
    connectUrl: '/admin/settings/integrations?service=twitter',
    icon: Twitter,
  },
  {
    value: 'GOOGLE_MY_BUSINESS',
    label: 'Google Business',
    serviceName: 'google_my_business',
    description: 'Keep the Google business profile fresh with offers, events, and review responses.',
    handle: process.env.NEXT_PUBLIC_GMB_SHORTNAME ?? 'Jose Madrid Salsa',
    connectUrl: '/admin/settings/integrations?service=google',
    icon: Store,
  },
  {
    value: 'TIKTOK',
    label: 'TikTok',
    serviceName: 'tiktok',
    description: 'Short-form video ideas for behind-the-scenes batches, recipe quick hits, and community shoutouts.',
    handle: process.env.NEXT_PUBLIC_TIKTOK_HANDLE ?? '@JoseMadridSalsa',
    connectUrl: '/admin/settings/integrations?service=tiktok',
    icon: Music2,
  },
]

async function getSocialMediaData() {
  const [recentPosts, scheduledPosts, statusCounts] = await Promise.all([
    prisma.socialMediaPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.socialMediaPost.findMany({
      where: {
        status: 'SCHEDULED',
      },
      orderBy: { scheduledAt: 'asc' },
      take: 6,
    }),
    prisma.socialMediaPost.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ])

  let serviceKeys: Array<{ serviceName: string; lastUsed: Date | null; isActive: boolean }> = []

  try {
    serviceKeys = await prisma.serviceKey.findMany({
      where: {
        serviceName: {
          in: SOCIAL_PLATFORM_CONFIG.map((platform) => platform.serviceName),
        },
      },
    })
  } catch (error) {
    console.error('[ADMIN_SOCIAL_INTEGRATIONS]', error)
  }

  const platformFrequency = recentPosts.reduce<Record<string, number>>((acc, post) => {
    post.platforms.forEach((platform) => {
      acc[platform] = (acc[platform] || 0) + 1
    })
    return acc
  }, {})

  const platformOptions: SocialPlatformOption[] = SOCIAL_PLATFORM_CONFIG.map((config) => {
    const serviceKey = serviceKeys.find(
      (key) => key.serviceName === config.serviceName && key.isActive,
    )

    return {
      value: config.value,
      label: config.label,
      description: config.description,
      handle: config.handle,
      connectUrl: config.connectUrl,
      isConnected: Boolean(serviceKey),
      lastSyncedAt: serviceKey?.lastUsed ? serviceKey.lastUsed.toISOString() : null,
    }
  })

  const integrationCards = SOCIAL_PLATFORM_CONFIG.map((config) => {
    const serviceKey = serviceKeys.find(
      (key) => key.serviceName === config.serviceName && key.isActive,
    )

    return {
      id: config.value,
      label: config.label,
      description: config.description,
      handle: config.handle,
      icon: config.icon,
      status: serviceKey ? 'connected' : 'not-connected',
      connectUrl: config.connectUrl,
      lastSyncedAt: serviceKey?.lastUsed ? serviceKey.lastUsed.toISOString() : null,
    }
  })

  return {
    recentPosts,
    scheduledPosts,
    statusCounts: statusCounts.map<StatusSummary>((item) => ({
      status: item.status,
      count: item._count._all,
    })),
    platformFrequency,
    platformOptions,
    integrationCards,
  }
}

async function updatePostStatus(postId: string, nextStatus: SocialMediaPostStatus) {
  'use server'

  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  const canPublish = await hasPermission(user, 'social_media:publish')
  if (!canPublish) {
    throw new Error('Forbidden')
  }

  await prisma.socialMediaPost.update({
    where: { id: postId },
    data: {
      status: nextStatus,
      publishedAt: nextStatus === 'PUBLISHED' ? new Date() : null,
    },
  })

  await logAudit({
    userId: user.id,
    action: 'social_post.status_change',
    entityType: 'SocialMediaPost',
    entityId: postId,
    changes: { status: nextStatus },
  })

  revalidatePath('/admin/social')
}

export default async function SocialMediaPage() {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'social_media:compose'))) {
    redirect('/admin')
  }

  const canPublish = await hasPermission(user, 'social_media:publish')
  const canSchedule = await hasPermission(user, 'social_media:schedule')

  const { recentPosts, scheduledPosts, statusCounts, platformFrequency, platformOptions, integrationCards } =
    await getSocialMediaData()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Social Media</h1>
          <p className="text-slate-600">
            Plan, schedule, and track content across all connected platforms.
          </p>
        </div>
        {(canSchedule || canPublish) && (
          <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Scheduling and publishing tools are enabled for your role.
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {integrationCards.map((integration) => {
          const Icon = integration.icon
          const isConnected = integration.status === 'connected'
          return (
            <Card
              key={integration.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full',
                    isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{integration.label}</p>
                  <p className="text-xs text-slate-500">{integration.handle}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600">{integration.description}</p>
              <div className="mt-auto flex items-center justify-between text-xs">
                <Badge
                  className={cn(
                    'px-2 py-1 text-[11px]',
                    isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {isConnected ? 'Connected' : 'Requires setup'}
                </Badge>
                <Button variant="link" size="sm" asChild className="px-0 text-xs">
                  <Link href={integration.connectUrl}>Manage</Link>
                </Button>
              </div>
              {integration.lastSyncedAt ? (
                <p className="text-[11px] text-slate-400">
                  Synced {new Date(integration.lastSyncedAt).toLocaleString()}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">No sync recorded yet</p>
              )}
            </Card>
          )
        })}
      </div>

      <SocialPostComposer
        action={createSocialPost}
        platformOptions={platformOptions}
        canSchedule={canSchedule}
        canPublish={canPublish}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statusCounts.map((item) => (
          <Card key={item.status} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">{item.status}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {item.count.toLocaleString()}
                </p>
              </div>
              <div className="rounded-full bg-slate-100 p-3">
                <Share2 className="h-6 w-6 text-slate-500" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Scheduled posts</h2>
              <p className="text-sm text-slate-600">Upcoming content across all platforms</p>
            </div>
          </div>
          {scheduledPosts.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Nothing is scheduled yet. Draft a post to add it to the calendar.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {scheduledPosts.map((post) => {
                const publishAction = updatePostStatus.bind(null, post.id, 'PUBLISHED')
                const cancelAction = updatePostStatus.bind(null, post.id, 'DRAFT')

                return (
                  <div
                    key={post.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {post.platforms.map((platform) => (
                            <Badge key={platform} className="bg-blue-100 text-blue-700">
                              {platformLabels[platform] || platform}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-2 text-sm text-slate-700 line-clamp-2">{post.content}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          Scheduled for {post.scheduledAt ? post.scheduledAt.toLocaleString() : 'unspecified'}
                        </p>
                      </div>
                      {canPublish && (
                        <div className="flex flex-col gap-2">
                          <form action={publishAction}>
                            <Button type="submit" size="sm">
                              Mark as published
                            </Button>
                          </form>
                          <form action={cancelAction}>
                            <Button type="submit" variant="outline" size="sm">
                              Unschedule
                            </Button>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold">Platform breakdown</h2>
          {Object.keys(platformFrequency).length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No posts created yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {Object.entries(platformFrequency)
                .sort((a, b) => b[1] - a[1])
                .map(([platform, count]) => (
                  <div key={platform} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      {platformLabels[platform] || platform}
                    </span>
                    <span className="text-sm text-slate-600">{count.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold">Recent posts</h2>
          <p className="text-sm text-slate-600">
            Latest activity across Facebook, Instagram, X, Google, and TikTok.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Content</th>
                <th className="px-4 py-3 text-left font-medium">Platforms</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Scheduled</th>
                <th className="px-4 py-3 text-left font-medium">Published</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                {canPublish && <th className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="text-sm">
              {recentPosts.length === 0 ? (
                <tr>
                  <td colSpan={canPublish ? 7 : 6} className="px-6 py-12 text-center text-slate-500">
                    No social posts created yet.
                  </td>
                </tr>
              ) : (
                recentPosts.map((post) => {
                  const moveToDraft = updatePostStatus.bind(null, post.id, 'DRAFT')
                  const markPublished = updatePostStatus.bind(null, post.id, 'PUBLISHED')
                  const markFailed = updatePostStatus.bind(null, post.id, 'FAILED')

                  return (
                    <tr key={post.id} className="border-b last:border-0">
                      <td className="px-4 py-4 text-slate-700">
                        <p className="line-clamp-3">{post.content}</p>
                        <p className="mt-2 text-xs text-slate-400">ID: {post.id}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {post.platforms.map((platform) => (
                            <Badge key={platform} className="bg-slate-100 text-slate-600">
                              {platformLabels[platform] || platform}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={statusStyles[post.status]}>{post.status}</Badge>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {post.scheduledAt ? post.scheduledAt.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {post.publishedAt ? post.publishedAt.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {post.createdAt.toLocaleString()}
                      </td>
                      {canPublish && (
                        <td className="px-4 py-4 text-right">
                          <div className="flex flex-col items-end gap-2">
                            <form action={markPublished}>
                              <Button type="submit" variant="ghost" size="sm">
                                Mark published
                              </Button>
                            </form>
                            <form action={moveToDraft}>
                              <Button type="submit" variant="ghost" size="sm">
                                Move to draft
                              </Button>
                            </form>
                            <form action={markFailed}>
                              <Button type="submit" variant="ghost" size="sm">
                                Flag as failed
                              </Button>
                            </form>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {canSchedule ? (
          <div className="flex items-center justify-between border-t px-6 py-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span>Need to schedule a new post?</span>
            </div>
            <Button variant="outline" disabled>
              Composer coming soon
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t px-6 py-4 text-sm text-slate-500">
            <Clock className="h-4 w-4" />
            You have read-only access to the social media calendar.
          </div>
        )}
      </Card>
    </div>
  )
}
