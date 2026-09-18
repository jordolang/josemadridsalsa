import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createMetadata } from '@/lib/metadata'
import { MessageBoard } from '@/components/fundraiser/MessageBoard'
import { FundraisingProgress } from '@/components/fundraiser/fundraising-progress'
import { TeamMembersStrip, type TeamMember } from '@/components/fundraiser/team-members-strip'
import { VerifiedBadge } from '@/components/fundraiser/verified-badge'
import { FundraiserSidebar } from '@/components/fundraiser/fundraiser-sidebar'
import { BattleArenaPanel } from '@/components/fundraiser/battle-arena-panel'
import type { SupporterFeedItem } from '@/components/fundraiser/supporter-feed'
import prisma from '@/lib/prisma'
import { FundraiserStore } from '@/components/fundraiser/fundraiser-store'
import {
  loadFundraiserStoreProducts,
  resolveFundraiserStore,
} from '@/lib/fundraising/store.server'

export const revalidate = 300 // 5 minutes

interface PageProps {
  params: Promise<{ slug: string }>
}

const DEFAULT_COVER = 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/shared/Hero-Image-Mike.webp'
const DEFAULT_LOGO = 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/shared/fundraising-icon.webp'

async function getFundraiser(slug: string) {
  return prisma.fundraiser.findUnique({
    where: { slug, isActive: true },
    include: {
      participants: {
        where: { status: 'ACTIVE' },
        orderBy: { totalRevenue: 'desc' },
        take: 8,
        select: {
          id: true,
          name: true,
          totalRevenue: true,
          totalOrders: true,
        },
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          total: true,
          createdAt: true,
          user: { select: { name: true } },
          participant: { select: { name: true } },
        },
      },
      _count: {
        select: { orders: true, participants: true },
      },
    },
  })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const fundraiser = await getFundraiser(slug)

  if (!fundraiser) {
    return createMetadata({
      title: 'Fundraiser Not Found',
      description: 'The fundraiser you are looking for could not be found.',
    })
  }

  return createMetadata({
    title: `${fundraiser.name} - Jose Madrid Salsa Fundraiser`,
    description:
      fundraiser.description ||
      `Support ${fundraiser.organizationName} by ordering delicious Jose Madrid Salsa!`,
    pathname: `/fundraisers/${slug}`,
  })
}

export default async function FundraiserPage({ params }: PageProps) {
  const { slug } = await params
  const fundraiser = await getFundraiser(slug)

  if (!fundraiser) {
    notFound()
  }

  const now = new Date()
  const isActive = now >= fundraiser.startDate && now <= fundraiser.endDate
  const isUpcoming = now < fundraiser.startDate
  const hasEnded = now > fundraiser.endDate

  const cover = fundraiser.coverPhotoUrl || DEFAULT_COVER
  const logo = fundraiser.logoUrl || DEFAULT_LOGO

  const raised = Number(fundraiser.totalRevenue)
  const goal = fundraiser.goal ? Number(fundraiser.goal) : 0
  const supporterCount = fundraiser._count.orders

  const teamMembers: TeamMember[] = fundraiser.participants.map((p) => ({
    id: p.id,
    name: p.name,
    amountRaised: Number(p.totalRevenue),
    supporterCount: p.totalOrders,
  }))

  const supporters: SupporterFeedItem[] = fundraiser.orders.map((o) => ({
    id: o.id,
    name: o.user?.name || 'Anonymous supporter',
    amount: Number(o.total),
    createdAt: o.createdAt.toISOString(),
    comment: o.participant
      ? `Supporting ${o.participant.name}'s fundraising effort.`
      : undefined,
  }))

  // The campaign's own store: its catalogue at its prices. Resolved through the same module
  // checkout uses, so the price quoted here is the price charged.
  const store = await resolveFundraiserStore({ fundraiserSlug: slug })
  const products = store ? await loadFundraiserStoreProducts(store) : []

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Main column */}
          <main className="min-w-0 space-y-8">
            {/* Logo + status */}
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white shadow ring-1 ring-border">
                <Image
                  src={logo}
                  alt={`${fundraiser.organizationName} logo`}
                  fill
                  sizes="64px"
                  className="object-contain p-2"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isActive && (
                  <Badge className="bg-green-500 text-white hover:bg-green-600">
                    Active Now
                  </Badge>
                )}
                {isUpcoming && (
                  <Badge className="bg-blue-500 text-white hover:bg-blue-600">
                    Upcoming
                  </Badge>
                )}
                {hasEnded && (
                  <Badge variant="secondary">Ended</Badge>
                )}
              </div>
            </div>

            {/* Title + tagline */}
            <div className="space-y-3">
              <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                {fundraiser.name}
              </h1>
              <p className="text-lg text-muted-foreground">
                Join {fundraiser.organizationName} in supporting this fundraiser.
              </p>
            </div>

            {/* Cover image */}
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted shadow-lg">
              <Image
                src={cover}
                alt={`${fundraiser.name} cover photo`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 65vw"
                className="object-cover"
              />
            </div>

            {/* Organized by + verified */}
            <div className="flex items-center justify-between gap-3 border-b pb-4">
              <p className="text-sm text-muted-foreground">
                Organized by{' '}
                <span className="font-semibold text-foreground">
                  {fundraiser.organizationName}
                </span>
              </p>
              <VerifiedBadge />
            </div>

            {/* Progress */}
            <FundraisingProgress
              raised={raised}
              goal={goal > 0 ? goal : Math.max(raised, 1)}
              supporterCount={supporterCount}
            />

            {/* Battle Arena (only renders if a FundraiserTeam exists for this slug) */}
            <BattleArenaPanel slug={slug} />

            {/* Team members */}
            {teamMembers.length > 0 && (
              <TeamMembersStrip title="Team Members" members={teamMembers} />
            )}

            {/* Story */}
            {fundraiser.description && (
              <section className="space-y-3">
                <h2 className="text-xl font-bold tracking-tight">Story</h2>
                <p className="whitespace-pre-line text-base leading-relaxed text-foreground/90">
                  {fundraiser.description}
                </p>
              </section>
            )}

            {/* Mission statement + bio when available */}
            {(fundraiser.missionStatement || fundraiser.bio) && (
              <section className="space-y-4">
                {fundraiser.missionStatement && (
                  <Card className="border-l-4 border-l-salsa-500">
                    <CardContent className="p-4">
                      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Our Mission
                      </p>
                      <p className="text-base text-foreground/90">
                        {fundraiser.missionStatement}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {fundraiser.bio && (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {fundraiser.bio}
                  </p>
                )}
              </section>
            )}

            {/* How it works */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight">How It Works</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    step: 1,
                    title: 'Shop',
                    desc: 'Browse handcrafted salsas and pick your favorites below.',
                  },
                  {
                    step: 2,
                    title: 'Support',
                    desc: `Your purchase automatically supports ${fundraiser.organizationName}.`,
                  },
                  {
                    step: 3,
                    title: 'Enjoy',
                    desc: 'Fresh salsa arrives at your door while helping a great cause.',
                  },
                ].map((item) => (
                  <Card key={item.step} className="card surface-shadow">
                    <CardContent className="p-4">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-salsa-500 to-chile-500 text-white font-bold">
                        {item.step}
                      </div>
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Products */}
            <section id="shop" className="scroll-mt-24 space-y-4">
              <FundraiserStore
                slug={fundraiser.slug}
                name={fundraiser.name}
                organizationName={fundraiser.organizationName}
                commissionRate={Number(fundraiser.commissionRate)}
                products={products}
              />
            </section>

            {/* Message board */}
            <section className="space-y-4">
              <MessageBoard slug={slug} />
            </section>

            {/* Contact */}
            <section className="rounded-2xl bg-muted p-6 text-center">
              <h2 className="text-xl font-serif font-bold text-foreground">
                Questions about this fundraiser?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Reach out to the fundraiser coordinator.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button asChild variant="outline">
                  <a href={`mailto:${fundraiser.contactEmail}`}>Email</a>
                </Button>
                {fundraiser.contactPhone && (
                  <Button asChild variant="outline">
                    <a href={`tel:${fundraiser.contactPhone}`}>Call</a>
                  </Button>
                )}
                <Button asChild>
                  <Link href="/fundraising">Start your own fundraiser</Link>
                </Button>
              </div>
            </section>
          </main>

          {/* Sidebar */}
          <FundraiserSidebar
            shareTitle={fundraiser.name}
            shareText={`Support ${fundraiser.organizationName} by shopping José Madrid Salsa.`}
            supporters={supporters}
            shopAnchor="shop"
            shopLabel="Shop & Support"
          />
        </div>
      </div>
    </div>
  )
}
