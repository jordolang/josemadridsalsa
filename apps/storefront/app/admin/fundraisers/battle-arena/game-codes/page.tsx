import Link from 'next/link'
import type { Metadata } from 'next'
import { requireAdminSession } from '@/lib/admin-auth'
import { prisma as db } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { GameCodes } from '../_components/game-codes'

export const metadata: Metadata = {
  title: 'Battle Arena Game Codes — Admin',
  description: 'Make and revoke the fundraiser codes players type into the Battle Arena browser game.',
}

export default async function BattleArenaGameCodesPage() {
  await requireAdminSession()

  const [codes, fundraisers] = await Promise.all([
    db.arenaGameCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { fundraiser: { select: { id: true, name: true } } },
      take: 500,
    }),
    db.fundraiser.findMany({
      where: { status: { in: ['DRAFT', 'ACTIVE'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, organizationName: true },
      take: 500,
    }),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Battle Arena Game Codes</h1>
          <p className="text-muted-foreground">
            Players type their group&apos;s code on the game&apos;s title screen to fight online and in
            tournaments. A code works on any device; revoke it to stop new players using it.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/fundraisers/battle-arena">Back to seasons</Link>
        </Button>
      </div>

      <GameCodes
        initialCodes={codes.map((c) => ({
          id: c.id,
          code: c.code,
          groupName: c.groupName,
          fundraiser: c.fundraiser,
          createdAt: c.createdAt.toISOString(),
          revokedAt: c.revokedAt?.toISOString() ?? null,
          lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
        }))}
        fundraisers={fundraisers}
      />
    </div>
  )
}
