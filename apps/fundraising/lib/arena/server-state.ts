import { prisma as db } from '@/lib/prisma'

export type ArenaShield = {
  id: string
  activatedAt: Date
  expiresAt: Date
  remainingHP: number
}

export type ArenaTeam = {
  id: string
  slug: string
  name: string
  school: string
  teamColor: string
  teamColorDark: string
  goalAmount: number
  salesCount: number
  pricePerUnit: number
  activePeriod: string
  raised: number
  hpCurrent: number
  hpMax: number
  characters: Array<{
    id: string
    characterName: string
    characterClass: string
    skinColor: string
    hairColor: string
    position: number
  }>
  activeShield: ArenaShield | null
}

export type ArenaSnapshot = {
  period: string
  teams: ArenaTeam[]
  takenAt: Date
}

/**
 * Reads every ACTIVE team for a given period plus their active shield (if
 * any), ordered by salesCount descending. Shaped for the spectator arena —
 * no write intent, safe to call from a server component.
 */
export async function loadArenaSnapshot(period: string): Promise<ArenaSnapshot> {
  const now = new Date()
  const teams = await db.fundraiserTeam.findMany({
    where: { status: 'ACTIVE', activePeriod: period },
    orderBy: { salesCount: 'desc' },
    include: {
      // The price per jar lives on the campaign that owns the store, so the arena's
      // "raised" figure and the shop cannot quote two different numbers.
      fundraiser: { select: { defaultUnitPrice: true } },
      characters: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          characterName: true,
          characterClass: true,
          skinColor: true,
          hairColor: true,
          position: true,
        },
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
    },
  })

  return {
    period,
    takenAt: now,
    teams: teams.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      school: t.school,
      teamColor: t.teamColor,
      teamColorDark: t.teamColorDark,
      goalAmount: t.goalAmount,
      salesCount: t.salesCount,
      pricePerUnit: Number(t.fundraiser.defaultUnitPrice),
      activePeriod: t.activePeriod,
      raised: t.salesCount * Number(t.fundraiser.defaultUnitPrice),
      hpCurrent: t.hpCurrent,
      hpMax: t.goalAmount,
      characters: t.characters,
      activeShield: t.shields[0] ?? null,
    })),
  }
}
