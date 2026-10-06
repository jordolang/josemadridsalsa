/**
 * Battle standings: who is winning one battle period, counted from that battle's own sale
 * events. The live `/battles` board and the season-end champion both come from here, so the
 * public leaderboard can never name a different winner from the one the season records.
 *
 * `FundraiserTeam.salesCount` is a lifetime counter — a team keeps it across periods and
 * seasons — so it is never used to rank a battle.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface BattleStanding {
  id: string
  slug: string
  name: string
  school: string
  logoUrl: string | null
  createdAt: Date
  /** Sales placed during this battle. */
  battleSales: number
  /** What those sales were worth. */
  battleRaised: number
  topSeller: { name: string; raised: number } | null
}

/** The teams in a battle: the season's own roster when the period has a season. */
async function battleTeamFilter(period: string): Promise<Prisma.FundraiserTeamWhereInput> {
  const season = await prisma.fundraiserSeason.findUnique({ where: { period }, select: { id: true } })
  return season ? { status: 'ACTIVE', seasonId: season.id } : { status: 'ACTIVE', activePeriod: period }
}

/** Ranked by battle sales, then earliest team (the season-end tie-break). */
export async function getBattleStandings(
  period: string,
  teamWhere?: Prisma.FundraiserTeamWhereInput,
): Promise<BattleStanding[]> {
  const teams = await prisma.fundraiserTeam.findMany({
    where: teamWhere ?? (await battleTeamFilter(period)),
    select: { id: true, slug: true, name: true, school: true, logoUrl: true, createdAt: true },
  })
  if (teams.length === 0) return []
  const teamIds = teams.map((t) => t.id)

  const [byTeam, bySeller] = await Promise.all([
    prisma.fundraiserSaleEvent.groupBy({
      by: ['teamId'],
      where: { period, teamId: { in: teamIds } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.fundraiserSaleEvent.groupBy({
      by: ['teamId', 'sellingCharacterId'],
      where: { period, teamId: { in: teamIds }, sellingCharacterId: { not: null } },
      _sum: { amount: true },
    }),
  ])

  const sellerIds = [...new Set(bySeller.map((row) => row.sellingCharacterId!))]
  const characters = sellerIds.length
    ? await prisma.fundraiserCharacter.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, characterName: true },
      })
    : []
  const nameById = new Map(characters.map((c) => [c.id, c.characterName]))

  const topSellerByTeam = new Map<string, { name: string; raised: number }>()
  for (const row of bySeller) {
    const raised = Number(row._sum.amount ?? 0)
    const best = topSellerByTeam.get(row.teamId)
    const name = nameById.get(row.sellingCharacterId!)
    if (name && (!best || raised > best.raised)) topSellerByTeam.set(row.teamId, { name, raised })
  }

  const totals = new Map(byTeam.map((row) => [row.teamId, row]))
  return teams
    .map((t) => ({
      ...t,
      battleSales: totals.get(t.id)?._count._all ?? 0,
      battleRaised: Number(totals.get(t.id)?._sum.amount ?? 0),
      topSeller: topSellerByTeam.get(t.id) ?? null,
    }))
    .sort((a, b) => b.battleSales - a.battleSales || a.createdAt.getTime() - b.createdAt.getTime())
}
