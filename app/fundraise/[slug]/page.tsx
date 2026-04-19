import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma as db } from '@/lib/prisma'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CampaignHeader } from '@/components/fundraiser/campaign-header'
import { HeroMedia } from '@/components/fundraiser/hero-media'
import { CampaignStats } from '@/components/fundraiser/campaign-stats'
import { TeamMembersStrip } from '@/components/fundraiser/team-members-strip'
import { SupporterFeed } from '@/components/fundraiser/supporter-feed'
import { DonateActionCard } from '@/components/fundraiser/donate-action-card'
import { BattleWidget } from '@/components/arena/battle-widget'
import type { AttackFeedItem } from '@/components/arena/attack-feed'
import { ShareStatusToast } from '@/components/arena/share-status-toast'

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
      characters: { orderBy: { position: 'asc' } },
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
    },
  })
  if (!team) notFound()

  const [recentSales, teammates, session] = await Promise.all([
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
      },
    }),
    db.fundraiserTeam.findMany({
      where: {
        activePeriod: team.activePeriod,
        status: 'ACTIVE',
        id: { not: team.id },
      },
      orderBy: { salesCount: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        salesCount: true,
        pricePerUnit: true,
      },
    }),
    getServerSession(authOptions),
  ])

  const raised = team.salesCount * team.pricePerUnit
  const supporterCount = team.salesCount

  const feedItems = recentSales.map((s) => {
    const displayName = s.isAnonymous
      ? 'Anonymous supporter'
      : (s.donorName ?? s.donor?.name ?? 'Anonymous supporter')
    return {
      id: s.id,
      name: displayName,
      avatarUrl: s.isAnonymous ? null : s.donorAvatarUrl,
      amount: Number(s.amount),
      createdAt: s.createdAt.toISOString(),
      comment: s.donorComment ?? undefined,
    }
  })

  const teamMemberCards = teammates.map((t) => ({
    id: t.id,
    name: t.name,
    amountRaised: t.salesCount * t.pricePerUnit,
    supporterCount: 0,
    href: `/fundraise/${t.slug}`,
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

  const campaignTitle = team.name
  const tagline = `Join ${team.school}'s ${team.activePeriod} fundraiser. Every jar sold powers their team and keeps them in the battle arena.`
  const storyFallback = `Every jar sold powers ${team.name}'s warrior in the Jose Madrid Salsa Fundraiser Battle Arena. Share this page to activate a 30-minute shield — then watch your team climb the arena leaderboard in real time.`

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-foreground">
      <ShareStatusToast />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-10 lg:gap-12 lg:px-6">
        <section className="space-y-8 lg:col-span-7">
          <CampaignHeader
            title={campaignTitle}
            tagline={tagline}
            organizerName={team.school}
          />

          <HeroMedia alt={`${campaignTitle} hero image`} />

          <CampaignStats
            raised={raised}
            goal={team.goalAmount}
            supporterCount={supporterCount}
            teamColor={team.teamColor}
          />

          {teamMemberCards.length > 0 && (
            <TeamMembersStrip members={teamMemberCards} />
          )}

          <Tabs defaultValue="story" className="w-full">
            <TabsList className="h-11 rounded-full bg-slate-100 p-1">
              <TabsTrigger
                value="story"
                className="rounded-full px-6 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow"
              >
                Story
              </TabsTrigger>
              {team.activePeriod && (
                <TabsTrigger
                  value="battle"
                  className="rounded-full px-6 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow"
                >
                  Battle
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="story" className="mt-6">
              <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Story
                </h2>
                <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-slate-700">
                  {storyFallback}
                </p>
              </article>
            </TabsContent>

            {team.activePeriod && (
              <TabsContent value="battle" className="mt-6">
                <BattleWidget
                  team={battleTeam}
                  period={team.activePeriod}
                  initialFeed={battleFeedItems}
                />
              </TabsContent>
            )}
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
              <SupporterFeed items={feedItems} />
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
