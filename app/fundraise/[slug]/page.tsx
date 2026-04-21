import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma as db } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CampaignHeader } from '@/components/fundraiser/campaign-header'
import { HeroMedia } from '@/components/fundraiser/hero-media'
import { CampaignStats } from '@/components/fundraiser/campaign-stats'
import { TeamMembersStrip } from '@/components/fundraiser/team-members-strip'
import { TeamRosterGrid } from '@/components/fundraiser/team-roster-grid'
import { SupporterFeedInteractive } from '@/components/fundraiser/supporter-feed-interactive'
import { DonateActionCard } from '@/components/fundraiser/donate-action-card'
import { TeamProductCatalog } from '@/components/fundraiser/team-product-catalog'
import { BattleWidget } from '@/components/arena/battle-widget'
import type { AttackFeedItem } from '@/components/arena/attack-feed'
import { ShareStatusToast } from '@/components/arena/share-status-toast'
import { ShareForShieldButton } from '@/components/arena/share-for-shield-button'
import { sanitizeStoryHtml } from '@/lib/sanitize-story'
import { StoryBody } from '@/components/fundraiser/story-body'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const team = await db.fundraiserTeam.findUnique({ where: { slug } })
  if (!team) return { title: 'Fundraiser Not Found' }
  return {
    title: `${team.name} — JMS Fundraiser Battle`,
    description: `Support ${team.name} from ${team.school} in the Jose Madrid Salsa Fundraiser Battle Arena!`,
    openGraph: {
      title: `${team.name} is battling in the JMS Fundraiser Arena!`,
      description: `Every sale powers their warrior. Share to activate a 15-minute shield!`,
      url: `https://josemadrid.net/fundraise/${slug}`,
    },
  }
}

export default async function FundraiserProfilePage({ params }: Props) {
  const { slug } = await params
  const now = new Date()
  const team = await db.fundraiserTeam.findUnique({
    where: { slug, status: 'ACTIVE' },
    include: {
      // Teammates (ex-"sibling teams" bug) — ordered by contribution so
      // the strip highlights top fundraisers. Falls back on position for
      // pre-donation seed order.
      characters: {
        orderBy: [{ amountRaised: 'desc' }, { position: 'asc' }],
      },
      shields: {
        where: { expiresAt: { gt: now }, remainingHP: { gt: 0 } },
        orderBy: { expiresAt: 'desc' },
        take: 1,
        select: {
          id: true,
          activatedAt: true,
          expiresAt: true,
          remainingHP: true,
        },
      },
      products: {
        where: { isActive: true, product: { isActive: true } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              description: true,
              featuredImage: true,
            },
          },
        },
      },
    },
  })
  if (!team) notFound()

  const [recentSales, session] = await Promise.all([
    db.fundraiserSaleEvent.findMany({
      where: { teamId: team.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        amount: true,
        createdAt: true,
        orderId: true,
        donorName: true,
        donorAvatarUrl: true,
        donorComment: true,
        isAnonymous: true,
        donor: { select: { name: true } },
        // Latest reply per sale event — `take: 1` with descending
        // createdAt returns the most recent one. The admin UI can show
        // more via a follow-up endpoint.
        replies: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { id: true, name: true } },
          },
        },
      },
    }),
    getServerSession(authOptions),
  ])

  // Reaction aggregates — count + 3 most recent lovers per sale event.
  // Two shape-only queries keep the page query simple; the full "did I
  // love this?" flag lives in the client via /api/…/love polling.
  const saleEventIds = recentSales.map((s) => s.id)
  const viewerId = (session?.user as { id?: string } | undefined)?.id
  const [loveCounts, recentLovers, viewerLoves] = await Promise.all([
    saleEventIds.length === 0
      ? Promise.resolve(
          [] as Array<{ saleEventId: string; _count: { _all: number } }>,
        )
      : db.fundraiserSaleEventReaction.groupBy({
          by: ['saleEventId'],
          where: { saleEventId: { in: saleEventIds } },
          _count: { _all: true },
        }),
    saleEventIds.length === 0
      ? Promise.resolve(
          [] as Array<{
            saleEventId: string
            user: { id: string; name: string | null }
          }>,
        )
      : db.fundraiserSaleEventReaction.findMany({
          where: { saleEventId: { in: saleEventIds } },
          orderBy: { createdAt: 'desc' },
          select: {
            saleEventId: true,
            user: { select: { id: true, name: true } },
          },
        }),
    !viewerId || saleEventIds.length === 0
      ? Promise.resolve([] as Array<{ saleEventId: string }>)
      : db.fundraiserSaleEventReaction.findMany({
          where: { userId: viewerId, saleEventId: { in: saleEventIds } },
          select: { saleEventId: true },
        }),
  ])
  const lovedIds = viewerLoves.map((r) => r.saleEventId)

  const loveCountBySaleId = new Map<string, number>(
    loveCounts.map((r) => [r.saleEventId, r._count._all]),
  )
  const loversBySaleId = new Map<
    string,
    Array<{ id: string; name: string | null }>
  >()
  for (const row of recentLovers) {
    const bucket = loversBySaleId.get(row.saleEventId) ?? []
    if (bucket.length < 3) {
      bucket.push(row.user)
      loversBySaleId.set(row.saleEventId, bucket)
    }
  }

  const raised = team.salesCount * team.pricePerUnit
  const supporterCount = team.salesCount

  const feedItems = recentSales.map((s) => {
    const displayName = s.isAnonymous
      ? 'Anonymous supporter'
      : (s.donorName ?? s.donor?.name ?? 'Anonymous supporter')
    const latestReply = s.replies[0]
    const loverNames = (loversBySaleId.get(s.id) ?? [])
      .map((u) => u.name)
      .filter((n): n is string => !!n)
    return {
      id: s.id,
      name: displayName,
      avatarUrl: s.isAnonymous ? null : s.donorAvatarUrl,
      amount: Number(s.amount),
      createdAt: s.createdAt.toISOString(),
      comment: s.donorComment ?? undefined,
      lovesCount: loveCountBySaleId.get(s.id) ?? 0,
      recentLovers: loverNames,
      reply: latestReply
        ? {
            authorName: latestReply.author.name ?? 'Team',
            body: latestReply.body,
            createdAt: latestReply.createdAt.toISOString(),
          }
        : undefined,
    }
  })

  // Teammate strip + roster grid — now sourced from team.characters
  // (ordered by amountRaised DESC), not sibling teams. Characters without
  // an avatar fall back to the shared `TeamMember.avatarUrl: null` path
  // (initial-based fallback rendered by the component).
  const teamMemberCards = team.characters.map((c) => ({
    id: c.id,
    name: c.characterName,
    avatarUrl: c.avatarUrl,
    amountRaised: c.amountRaised,
    supporterCount: c.supporterCount,
    // No per-character public profile yet — link the whole strip item
    // back to this team for now. Swap to /fundraise/{slug}/{charId} once
    // that route lands.
    href: undefined,
  }))

  const battleFeedItems: AttackFeedItem[] = recentSales.map((s) => ({
    id: s.id,
    actorName: s.isAnonymous
      ? 'Anonymous supporter'
      : (s.donorName ?? s.donor?.name ?? 'Anonymous supporter'),
    actorAvatarUrl: s.isAnonymous ? null : s.donorAvatarUrl,
    amount: Number(s.amount),
    createdAt: s.createdAt.toISOString(),
    direction: 'outgoing',
  }))

  const battleTeam = {
    id: team.id,
    slug: team.slug,
    name: team.name,
    teamColor: team.teamColor,
    teamColorDark: team.teamColorDark,
    hpCurrent: team.hpCurrent,
    hpMax: team.goalAmount,
    activeShield: team.shields[0] ?? null,
  }

  const catalogProducts = team.products.map((tp) => ({
    id: tp.id,
    productId: tp.product.id,
    name: tp.product.name,
    slug: tp.product.slug,
    price: Number(tp.price ?? tp.product.price),
    imageUrl: tp.product.featuredImage,
    description: tp.product.description,
  }))

  // T1 fields are nullable; fall back to the same synthetic copy the page
  // used before the admin edit form exists. `team.storyHtml`, `logoUrl`,
  // `heroImageUrl`, `heroVideoUrl` are available on the `team` object and
  // will be wired into Story / Hero components by @bob.
  const campaignTitle = team.campaignTitle ?? team.name
  const tagline =
    team.tagline ??
    `Join ${team.school}'s ${team.activePeriod} fundraiser. Every jar sold powers their team and keeps them in the battle arena.`
  const storyFallback = `Every jar sold powers ${team.name}'s warrior in the Jose Madrid Salsa Fundraiser Battle Arena. Share this page to activate a 30-minute shield — then watch your team climb the arena leaderboard in real time.`
  const sanitizedStoryHtml = sanitizeStoryHtml(team.storyHtml)

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-foreground">
      <ShareStatusToast />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-10 lg:gap-12 lg:px-6">
        <section className="space-y-8 lg:col-span-7">
          <CampaignHeader
            title={campaignTitle}
            tagline={tagline}
            organizerName={team.school}
            logoUrl={team.logoUrl}
          />

          <HeroMedia
            alt={`${campaignTitle} hero image`}
            imageUrl={team.heroImageUrl}
            videoUrl={team.heroVideoUrl}
            teamColor={team.teamColor}
            teamColorDark={team.teamColorDark}
          />

          <CampaignStats
            raised={raised}
            goal={team.goalAmount}
            supporterCount={supporterCount}
            teamColor={team.teamColor}
          />

          <Tabs
            defaultValue={
              catalogProducts.length > 0
                ? 'shop'
                : team.activePeriod
                  ? 'battle'
                  : 'story'
            }
            className="w-full"
          >
            <TabsList className="h-11 rounded-full bg-muted/60 p-1">
              <TabsTrigger
                value="story"
                className="rounded-full px-6 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow"
              >
                Story
              </TabsTrigger>
              {catalogProducts.length > 0 && (
                <TabsTrigger
                  value="shop"
                  className="rounded-full px-6 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow"
                >
                  Shop
                </TabsTrigger>
              )}
              {team.activePeriod && (
                <TabsTrigger
                  value="battle"
                  className="rounded-full px-6 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow"
                >
                  Battle
                </TabsTrigger>
              )}
              <TabsTrigger
                value="team"
                className="rounded-full px-6 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow"
              >
                Team
              </TabsTrigger>
            </TabsList>

            <TabsContent value="story" className="mt-6 space-y-6">
              {teamMemberCards.length > 0 && (
                <TeamMembersStrip members={teamMemberCards} />
              )}
              <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Story
                </h2>
                {sanitizedStoryHtml ? (
                  <StoryBody
                    html={sanitizedStoryHtml}
                    className="prose prose-slate mt-4 max-w-none text-base leading-relaxed text-slate-700"
                  />
                ) : (
                  <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-slate-700">
                    {storyFallback}
                  </p>
                )}
              </article>
            </TabsContent>

            {catalogProducts.length > 0 && (
              <TabsContent value="shop" className="mt-6">
                <TeamProductCatalog
                  teamId={team.id}
                  teamSlug={team.slug}
                  teamName={team.name}
                  teamColor={team.teamColor}
                  products={catalogProducts}
                />
              </TabsContent>
            )}

            {team.activePeriod && (
              <TabsContent value="battle" className="mt-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <ShareForShieldButton teamId={team.id} teamName={team.name} />
                  <Link
                    href={`/arena/${team.activePeriod}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Open full arena
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <BattleWidget
                  team={battleTeam}
                  period={team.activePeriod}
                  initialFeed={battleFeedItems}
                />
              </TabsContent>
            )}

            <TabsContent value="team" className="mt-6">
              <TeamRosterGrid members={teamMemberCards} />
            </TabsContent>
          </Tabs>
        </section>

        <aside className="space-y-6 lg:col-span-3">
          <div className="lg:sticky lg:top-6 lg:space-y-6">
            <DonateActionCard
              teamId={team.id}
              teamSlug={team.slug}
              teamName={team.name}
              pricePerUnit={team.pricePerUnit}
              viewer={
                session?.user
                  ? {
                      name: session.user.name ?? null,
                      email: session.user.email ?? null,
                    }
                  : undefined
              }
            />
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Recent supporters
              </h2>
              <SupporterFeedInteractive
                items={feedItems}
                initialLovedIds={lovedIds}
                currentUserName={session?.user?.name ?? null}
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
