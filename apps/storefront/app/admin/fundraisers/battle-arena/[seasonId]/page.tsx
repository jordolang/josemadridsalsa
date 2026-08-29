import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Trophy } from 'lucide-react'
import { requireAdminSession } from '@/lib/admin-auth'
import { prisma as db } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SeasonActions } from '../_components/season-actions'
import { SeasonRoster } from '../_components/season-roster'
import type { SeasonStatus } from '@prisma/client'

export const metadata: Metadata = {
  title: 'Season detail — Admin',
}

const statusVariant: Record<
  SeasonStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  DRAFT: 'outline',
  ACTIVE: 'default',
  ENDED: 'secondary',
  ARCHIVED: 'secondary',
}

interface Props {
  params: Promise<{ seasonId: string }>
}

export default async function SeasonDetailPage({ params }: Props) {
  await requireAdminSession()
  const { seasonId } = await params

  const [season, availableTeams] = await Promise.all([
    db.fundraiserSeason.findUnique({
      where: { id: seasonId },
      include: {
        championTeam: { select: { id: true, name: true, slug: true } },
        teams: {
          orderBy: { salesCount: 'desc' },
          select: {
            id: true,
            slug: true,
            name: true,
            school: true,
            status: true,
            teamColor: true,
            goalAmount: true,
            salesCount: true,
            hpCurrent: true,
            fundraiser: { select: { defaultUnitPrice: true } },
          },
        },
      },
    }),
    db.fundraiserTeam.findMany({
      where: { status: 'ACTIVE', seasonId: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        school: true,
        slug: true,
        activePeriod: true,
      },
      take: 100,
    }),
  ])

  if (!season) notFound()

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-3xl font-bold tracking-tight">
              {season.period}
            </h1>
            <Badge variant={statusVariant[season.status]}>
              {season.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {season.startsAt.toLocaleDateString()} →{' '}
            {season.endsAt.toLocaleDateString()}
            {season.championTeam && (
              <span className="ml-3 inline-flex items-center gap-1 font-semibold text-amber-600">
                <Trophy className="h-3.5 w-3.5" />
                Champion: {season.championTeam.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/fundraisers/battle-arena">Back</Link>
          </Button>
          <SeasonActions
            seasonId={season.id}
            status={season.status}
            hasTeams={season.teams.length > 0}
          />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          Roster ({season.teams.length})
        </h2>
        <SeasonRoster
          seasonId={season.id}
          teams={season.teams.map((t) => ({
            id: t.id,
            slug: t.slug,
            name: t.name,
            school: t.school,
            status: t.status,
            teamColor: t.teamColor,
            goalAmount: t.goalAmount,
            salesCount: t.salesCount,
            hpCurrent: t.hpCurrent,
            raised: t.salesCount * Number(t.fundraiser.defaultUnitPrice),
          }))}
          availableTeams={availableTeams}
          seasonLocked={season.status === 'ENDED' || season.status === 'ARCHIVED'}
        />
      </section>

      {season.rulesJson !== null && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Rule overrides</h2>
          <Card className="p-4">
            <pre className="overflow-x-auto font-mono text-xs text-muted-foreground">
              {JSON.stringify(season.rulesJson, null, 2)}
            </pre>
          </Card>
        </section>
      )}
    </div>
  )
}
