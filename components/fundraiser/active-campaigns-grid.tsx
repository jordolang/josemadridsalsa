import Image from 'next/image'
import Link from 'next/link'
import { Calendar, Users, Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import prisma from '@/lib/prisma'

export interface ActiveCampaignsGridProps {
  /** Max number of campaigns to display. */
  limit?: number
  /** Section heading above the grid. */
  heading?: string
  /** Short subheading/description under the heading. */
  subheading?: string
  /** Optional extra wrapper classes. */
  className?: string
}

const DEFAULT_MASCOT = '/images/fundraising-icon.png'

interface CampaignCard {
  id: string
  slug: string
  name: string
  description: string | null
  organizationName: string
  coverPhotoUrl: string | null
  logoUrl: string | null
  startDate: Date
  endDate: Date
  goal: number | null
  totalRevenue: number
  participantCount: number
}

async function getActiveCampaigns(limit: number): Promise<CampaignCard[]> {
  const now = new Date()

  const campaigns = await prisma.fundraiser.findMany({
    where: {
      isActive: true,
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: {
      _count: { select: { participants: true } },
    },
    orderBy: { endDate: 'asc' },
    take: limit,
  })

  return campaigns.map((campaign) => ({
    id: campaign.id,
    slug: campaign.slug,
    name: campaign.name,
    description: campaign.description,
    organizationName: campaign.organizationName,
    coverPhotoUrl: campaign.coverPhotoUrl,
    logoUrl: campaign.logoUrl,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    goal: campaign.goal ? Number(campaign.goal) : null,
    totalRevenue: Number(campaign.totalRevenue),
    participantCount: campaign._count.participants,
  }))
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatEndDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysRemaining(endDate: Date): number {
  const diffMs = endDate.getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

export async function ActiveCampaignsGrid({
  limit = 6,
  heading = 'Active Fundraising Campaigns',
  subheading = 'Support a team near you — every jar helps them reach their goal.',
  className,
}: ActiveCampaignsGridProps) {
  const campaigns = await getActiveCampaigns(limit)

  if (campaigns.length === 0) {
    return null
  }

  return (
    <section className={`py-16 ${className ?? ''}`.trim()}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-semibold uppercase tracking-widest text-salsa-600 mb-3">
            Fundraise With Jose
          </span>
          <h2 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-4">
            {heading}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {subheading}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <CampaignCardItem key={campaign.id} campaign={campaign} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/fundraising"
            className="btn-secondary text-base px-6 py-2.5 inline-block"
          >
            Learn About Fundraising →
          </Link>
        </div>
      </div>
    </section>
  )
}

interface CampaignCardItemProps {
  campaign: CampaignCard
}

function CampaignCardItem({ campaign }: CampaignCardItemProps) {
  const mascotImage = campaign.logoUrl || DEFAULT_MASCOT
  const bannerImage = campaign.coverPhotoUrl
  const progressPct =
    campaign.goal && campaign.goal > 0
      ? Math.min(100, Math.round((campaign.totalRevenue / campaign.goal) * 100))
      : null
  const remaining = daysRemaining(campaign.endDate)

  return (
    <Link
      href={`/fundraisers/${campaign.slug}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-salsa-500 focus-visible:ring-offset-2 rounded-xl"
      aria-label={`View ${campaign.name} fundraiser page`}
    >
      <Card className="card surface-shadow overflow-hidden h-full flex flex-col transition-transform group-hover:-translate-y-1">
        {/* Banner with mascot overlay */}
        <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-verde-100 via-salsa-50 to-chile-100 dark:from-verde-900/30 dark:via-salsa-900/20 dark:to-chile-900/30">
          {bannerImage && (
            <Image
              src={bannerImage}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover opacity-60"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

          {/* Mascot avatar — primary team visual */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-28 h-28 lg:w-32 lg:h-32 rounded-full bg-white dark:bg-background shadow-xl ring-4 ring-white dark:ring-background overflow-hidden">
              <Image
                src={mascotImage}
                alt={`${campaign.organizationName} mascot`}
                fill
                sizes="128px"
                className="object-contain p-2"
              />
            </div>
          </div>

          <Badge className="absolute top-3 left-3 bg-green-500 text-white hover:bg-green-600 shadow">
            Active
          </Badge>
          {remaining > 0 && remaining <= 30 && (
            <Badge className="absolute top-3 right-3 bg-salsa-600 text-white hover:bg-salsa-700 shadow">
              {remaining} {remaining === 1 ? 'day' : 'days'} left
            </Badge>
          )}
        </div>

        <CardContent className="flex flex-col flex-1 p-5 gap-4">
          <div>
            <h3 className="text-xl font-serif font-bold text-foreground leading-tight group-hover:text-salsa-600 transition-colors">
              {campaign.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Supporting {campaign.organizationName}
            </p>
          </div>

          {campaign.description && (
            <p className="text-sm text-foreground/80 line-clamp-3">
              {campaign.description}
            </p>
          )}

          {progressPct !== null && campaign.goal !== null && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-bold text-foreground">
                  {formatCurrency(campaign.totalRevenue)}
                </span>
                <span className="text-xs text-muted-foreground">
                  of {formatCurrency(campaign.goal)} goal
                </span>
              </div>
              <Progress
                value={progressPct}
                aria-label={`${progressPct}% of goal raised`}
              />
            </div>
          )}

          <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              {campaign.participantCount}{' '}
              {campaign.participantCount === 1 ? 'member' : 'members'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              {progressPct === null ? (
                <Target className="w-4 h-4" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
              Ends {formatEndDate(campaign.endDate)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
