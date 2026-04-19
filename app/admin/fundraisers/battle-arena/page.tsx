import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus, Trophy } from 'lucide-react'
import { requireAdminSession } from '@/lib/admin-auth'
import { prisma as db } from '@/lib/prisma'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { SeasonStatus } from '@prisma/client'

export const metadata: Metadata = {
  title: 'Battle Arena Seasons — Admin',
  description:
    'Manage FundraiserSeason rows: create, roster teams, reset HP, and end seasons.',
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

export default async function BattleArenaSeasonsAdminPage() {
  await requireAdminSession()

  const seasons = await db.fundraiserSeason.findMany({
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      championTeam: { select: { id: true, name: true, slug: true } },
      _count: { select: { teams: true } },
    },
    take: 50,
  })

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Battle Arena Seasons</h1>
          <p className="text-muted-foreground">
            Each season scopes a cohort of fundraiser teams to a period. Create a
            draft, roster teams, then activate.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/fundraisers">Back to Fundraisers</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/fundraisers/battle-arena/new">
              <Plus className="mr-2 h-4 w-4" />
              New season
            </Link>
          </Button>
        </div>
      </div>

      {seasons.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" />
          <p className="text-lg font-medium">No seasons yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first battle arena season to get started.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/admin/fundraisers/battle-arena/new">
              <Plus className="mr-2 h-4 w-4" />
              New season
            </Link>
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Period</th>
                <th className="p-3">Status</th>
                <th className="p-3">Window</th>
                <th className="p-3 text-right">Teams</th>
                <th className="p-3">Champion</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s) => (
                <tr key={s.id} className="border-b last:border-b-0">
                  <td className="p-3 font-mono font-semibold">{s.period}</td>
                  <td className="p-3">
                    <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {s.startsAt.toLocaleDateString()} →{' '}
                    {s.endsAt.toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {s._count.teams}
                  </td>
                  <td className="p-3 text-xs">
                    {s.championTeam ? (
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Trophy className="h-3 w-3 text-amber-500" />
                        {s.championTeam.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        href={`/admin/fundraisers/battle-arena/${s.id}`}
                      >
                        Manage
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
