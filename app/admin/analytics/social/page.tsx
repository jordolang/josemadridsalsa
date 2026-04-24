import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Activity,
  BarChart3,
  Eye,
  Heart,
  MessageCircle,
  MousePointer2,
  Repeat2,
  Send,
  TrendingUp,
  Users,
} from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { StatsCard } from '@/components/admin/StatsCard'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createMetadata } from '@/lib/metadata'
import { RANGE_OPTIONS, getDateRange, type AnalyticsRangeKey } from '@/lib/analytics/date-range'
import { AnalyticsRangeSelect } from '@/components/admin/AnalyticsRangeSelect'
import type { SocialMediaPlatform } from '@prisma/client'

export const metadata: Metadata = createMetadata({
  title: 'Social Analytics - Jose Madrid Salsa Admin',
  description: 'Engagement, reach, and publish performance across connected social accounts.',
  pathname: '/admin/analytics/social',
})

const PLATFORM_COLORS: Record<SocialMediaPlatform, string> = {
  FACEBOOK: 'bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/20',
  INSTAGRAM: 'bg-[#E4405F]/10 text-[#E4405F] border-[#E4405F]/20',
  TWITTER: 'bg-foreground/10 text-foreground border-foreground/20',
  TIKTOK: 'bg-foreground/10 text-foreground border-foreground/20',
  GOOGLE_MY_BUSINESS: 'bg-[#4285F4]/10 text-[#4285F4] border-[#4285F4]/20',
}

type SearchParams = { range?: string }

function rangeKeyFromParam(raw: string | undefined): AnalyticsRangeKey {
  const match = RANGE_OPTIONS.find((r) => r.value === raw)
  return (match?.value ?? '30d') as AnalyticsRangeKey
}

export default async function SocialAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:compose'))) {
    redirect('/admin')
  }

  const rangeKey = rangeKeyFromParam(params.range)
  const { start, end } = getDateRange(rangeKey)

  const [accounts, publishes, platformAggregates, topPosts, statusCounts] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountHandle: true,
        profileImageUrl: true,
        lastVerifiedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.socialPostPublish.findMany({
      where: {
        publishedAt: { gte: start, lte: end },
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        platform: true,
        likes: true,
        comments: true,
        shares: true,
        impressions: true,
        reach: true,
        clicks: true,
      },
    }),
    prisma.socialPostPublish.groupBy({
      by: ['platform'],
      where: { publishedAt: { gte: start, lte: end }, status: 'PUBLISHED' },
      _sum: {
        likes: true,
        comments: true,
        shares: true,
        impressions: true,
        reach: true,
        clicks: true,
      },
      _count: { _all: true },
    }),
    prisma.socialPostPublish.findMany({
      where: {
        publishedAt: { gte: start, lte: end },
        status: 'PUBLISHED',
      },
      orderBy: [{ impressions: 'desc' }, { likes: 'desc' }],
      take: 15,
      include: {
        post: {
          select: { id: true, content: true, hashtags: true, linkUrl: true },
        },
        account: {
          select: { accountName: true, accountHandle: true, profileImageUrl: true },
        },
      },
    }),
    prisma.socialMediaPost.groupBy({
      by: ['status'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { _all: true },
    }),
  ])

  const totals = publishes.reduce(
    (acc, p) => {
      acc.posts += 1
      acc.likes += p.likes
      acc.comments += p.comments
      acc.shares += p.shares
      acc.impressions += p.impressions
      acc.reach += p.reach
      acc.clicks += p.clicks
      return acc
    },
    { posts: 0, likes: 0, comments: 0, shares: 0, impressions: 0, reach: 0, clicks: 0 },
  )

  const engagement = totals.likes + totals.comments + totals.shares
  const engagementRate = totals.impressions > 0 ? (engagement / totals.impressions) * 100 : 0
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0

  const statusMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count._all]),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Social Analytics</h1>
          <p className="text-muted-foreground">
            Engagement across connected Facebook, Instagram, X, and TikTok accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AnalyticsRangeSelect value={rangeKey} />
          <Button variant="outline" asChild>
            <Link href="/admin/analytics">← Overview</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/social">Open Composer</Link>
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Published posts"
          value={totals.posts.toLocaleString()}
          icon={Send}
          color="blue"
        />
        <StatsCard
          title="Impressions"
          value={totals.impressions.toLocaleString()}
          icon={Eye}
          color="blue"
        />
        <StatsCard
          title="Engagement"
          value={engagement.toLocaleString()}
          subtitle={`${engagementRate.toFixed(2)}% rate`}
          icon={Heart}
          color="red"
        />
        <StatsCard
          title="Clicks"
          value={totals.clicks.toLocaleString()}
          subtitle={`${ctr.toFixed(2)}% CTR`}
          icon={MousePointer2}
          color="green"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Likes" value={totals.likes.toLocaleString()} icon={Heart} color="red" />
        <StatsCard title="Comments" value={totals.comments.toLocaleString()} icon={MessageCircle} color="purple" />
        <StatsCard title="Shares" value={totals.shares.toLocaleString()} icon={Repeat2} color="orange" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Scheduled posts"
          value={(statusMap['SCHEDULED'] ?? 0).toLocaleString()}
          icon={Activity}
          color="purple"
        />
        <StatsCard
          title="Drafts"
          value={(statusMap['DRAFT'] ?? 0).toLocaleString()}
          icon={Activity}
          
        />
        <StatsCard
          title="Failed"
          value={(statusMap['FAILED'] ?? 0).toLocaleString()}
          icon={Activity}
          color="red"
        />
      </div>

      {/* Platform breakdown */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Platform breakdown</h2>
        </div>
        {platformAggregates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No published posts in this range yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Posts</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Reach</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Comments</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platformAggregates.map((p) => (
                  <TableRow key={p.platform}>
                    <TableCell>
                      <Badge className={PLATFORM_COLORS[p.platform]}>{p.platform}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p._count._all.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{(p._sum.impressions ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{(p._sum.reach ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{(p._sum.likes ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{(p._sum.comments ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{(p._sum.shares ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{(p._sum.clicks ?? 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Connected accounts */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Connected accounts</h2>
        </div>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No accounts connected yet.{' '}
            <Link href="/admin/social" className="text-primary underline">
              Connect one →
            </Link>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-md border p-3">
                {a.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.profileImageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">
                    {a.accountName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.accountName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.accountHandle || a.platform}
                  </p>
                </div>
                <Badge className={`ml-auto shrink-0 ${PLATFORM_COLORS[a.platform]}`}>{a.platform}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Top posts */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Top posts by impressions</h2>
        </div>
        {topPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Once posts publish and metrics sync, the best performers will show here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Impr.</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Comm.</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPosts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-[340px]">
                      <p className="line-clamp-2 text-sm">{p.post.content}</p>
                      {p.post.hashtags.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.post.hashtags.map((h) => `#${h}`).join(' ')}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={PLATFORM_COLORS[p.platform]}>{p.platform}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.likes.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.comments.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.shares.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.clicks.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
