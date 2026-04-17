import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { prisma as db } from '@/lib/prisma'
import { FundraisingProgress } from '@/components/fundraiser/fundraising-progress'
import { TeamMembersStrip } from '@/components/fundraiser/team-members-strip'
import { SupporterFeed } from '@/components/fundraiser/supporter-feed'
import { VerifiedBadge } from '@/components/fundraiser/verified-badge'
import { DonateActionCard } from '@/components/fundraiser/donate-action-card'

interface Props { params: Promise<{ slug: string }> }

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
  const team = await db.fundraiserTeam.findUnique({
    where: { slug, status: 'ACTIVE' },
    include: { characters: { orderBy: { position: 'asc' } } },
  })
  if (!team) notFound()

  const [recentSales, teammates] = await Promise.all([
    db.fundraiserSaleEvent.findMany({
      where: { teamId: team.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, amount: true, createdAt: true, orderId: true },
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
  ])

  const raised = team.salesCount * team.pricePerUnit
  const supporterCount = recentSales.length

  const feedItems = recentSales.map((s) => ({
    id: s.id,
    name: 'Anonymous supporter',
    amount: Number(s.amount),
    createdAt: s.createdAt.toISOString(),
  }))

  const teamMemberCards = teammates.map((t) => ({
    id: t.id,
    name: t.name,
    amountRaised: t.salesCount * t.pricePerUnit,
    supporterCount: 0,
    href: `/fundraise/${t.slug}`,
  }))

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-3 lg:px-6">
        <section className="space-y-8 lg:col-span-2">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo-image.png"
              alt="Jose Madrid Salsa"
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded"
            />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Jose Madrid Salsa Fundraiser
            </span>
          </div>

          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {team.name}
            </h1>
            <p className="text-base text-muted-foreground">
              Join {team.school}&apos;s {team.activePeriod} fundraiser battle.
            </p>
          </header>

          <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted">
            <Image
              src="/images/jose-madrid-profile-1024.png"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 720px, 100vw"
              className="object-cover"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Organized by{' '}
              <span className="font-semibold text-foreground">
                {team.school}
              </span>
            </div>
            <VerifiedBadge />
          </div>

          <FundraisingProgress
            raised={raised}
            goal={team.goalAmount}
            supporterCount={supporterCount}
          />

          {teamMemberCards.length > 0 && (
            <TeamMembersStrip members={teamMemberCards} />
          )}

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight">Story</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Every jar sold powers {team.name}&apos;s warrior in the Jose
              Madrid Salsa Fundraiser Battle Arena. Share this page to
              activate a 30-minute shield — then watch your team climb the
              arena leaderboard in real time.
            </p>
          </section>
        </section>

        <aside className="space-y-4 lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            <DonateActionCard
              teamId={team.id}
              teamSlug={team.slug}
              teamName={team.name}
              pricePerUnit={team.pricePerUnit}
            />
          </div>
          <div className="lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
            <SupporterFeed items={feedItems} />
          </div>
        </aside>
      </div>
    </main>
  )
}
