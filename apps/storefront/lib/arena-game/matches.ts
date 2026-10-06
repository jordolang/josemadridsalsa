/**
 * Battle Arena game results and leaderboards.
 *
 * The game opens a match when the fight starts and closes it with the player's result when it
 * ends. Closing applies the result to the player's running totals in the same transaction, and
 * only an open match can be closed, so a result is counted once however often it is sent.
 */
import type { ArenaPlayer, Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { ArenaGameError } from './http'
import {
  MATCH_STARTS_PER_HOUR,
  implausibleResult,
  modesFor,
  periodStart,
  type FinishMatchInput,
  type LeaderboardQuery,
  type StartMatchInput,
} from './rules'

export async function startMatch(player: ArenaPlayer, input: StartMatchInput) {
  const recent = await prisma.arenaMatch.count({
    where: { playerId: player.id, startedAt: { gt: new Date(Date.now() - 3_600_000) } },
  })
  if (recent >= MATCH_STARTS_PER_HOUR) {
    throw new ArenaGameError('That is a lot of fights for one hour. Take a breather and come back soon.', 429, 'rate_limited')
  }
  const match = await prisma.arenaMatch.create({
    data: {
      playerId: player.id,
      teamId: player.teamId,
      mode: input.mode,
      fighter: input.fighter ?? null,
      opponents: input.opponents,
      room: input.room ?? null,
    },
    select: { id: true, startedAt: true },
  })
  return { matchId: match.id, startedAt: match.startedAt }
}

export async function finishMatch(player: ArenaPlayer, matchId: string, input: FinishMatchInput) {
  const match = await prisma.arenaMatch.findUnique({ where: { id: matchId } })
  if (!match || match.playerId !== player.id) throw new ArenaGameError('No such match.', 404)
  if (match.finishedAt) return { recorded: false, reason: 'Already recorded.' }
  const problem = implausibleResult(input, match)
  if (problem) throw new ArenaGameError(problem, 422, 'rejected')

  const win = input.won ? 1 : 0
  const damage = Math.round(input.damage)
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    // The open-match condition makes a repeated or concurrent report a no-op.
    const closed = await tx.arenaMatch.updateMany({
      where: { id: match.id, finishedAt: null },
      data: { finishedAt: now, win, roundsWon: input.roundsWon, knockouts: input.knockouts, damage },
    })
    if (closed.count === 0) return { recorded: false, reason: 'Already recorded.' }
    const fresh = await tx.arenaPlayer.findUniqueOrThrow({ where: { id: player.id }, select: { currentStreak: true, bestStreak: true } })
    const streak = win ? fresh.currentStreak + 1 : 0
    await tx.arenaPlayer.update({
      where: { id: player.id },
      data: {
        matches: { increment: 1 },
        wins: { increment: win },
        roundsWon: { increment: input.roundsWon },
        knockouts: { increment: input.knockouts },
        damage: { increment: damage },
        currentStreak: streak,
        bestStreak: Math.max(fresh.bestStreak, streak),
        lastPlayedAt: now,
      },
    })
    return { recorded: true, streak }
  })
}

type Totals = { matches: number; wins: number; roundsWon: number; knockouts: number; damage: number }

const totals = (row: { _count: { _all: number }; _sum: { win: number | null; roundsWon: number | null; knockouts: number | null; damage: number | null } }): Totals => ({
  matches: row._count._all,
  wins: row._sum.win ?? 0,
  roundsWon: row._sum.roundsWon ?? 0,
  knockouts: row._sum.knockouts ?? 0,
  damage: row._sum.damage ?? 0,
})

/**
 * A leaderboard. Players rank by wins, then knockouts; groups the same way over all their
 * players' matches. Every board but the all-time player board sums the match history.
 */
export async function leaderboard(query: LeaderboardQuery, now = new Date()) {
  const since = periodStart(query.period, now)
  const where: Prisma.ArenaMatchWhereInput = {
    finishedAt: since ? { gte: since } : { not: null },
    mode: { in: modesFor(query.mode) },
    ...(query.teamId ? { teamId: query.teamId } : {}),
  }
  const sum = { win: true, roundsWon: true, knockouts: true, damage: true } as const

  if (query.board === 'teams') {
    const rows = await prisma.arenaMatch.groupBy({
      by: ['teamId'],
      where: { ...where, teamId: query.teamId ?? { not: null } },
      _count: { _all: true },
      _sum: sum,
      orderBy: [{ _sum: { win: 'desc' } }, { _sum: { knockouts: 'desc' } }],
      take: query.limit,
    })
    const ids = rows.map((r) => r.teamId as string)
    const [teams, players] = await Promise.all([
      prisma.fundraiserTeam.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, name: true, school: true, teamColor: true } }),
      prisma.arenaMatch.groupBy({ by: ['teamId', 'playerId'], where: { ...where, teamId: { in: ids } } }),
    ])
    const byId = new Map(teams.map((t) => [t.id, t]))
    const fighters = new Map<string, number>()
    for (const p of players) fighters.set(p.teamId as string, (fighters.get(p.teamId as string) ?? 0) + 1)
    return {
      board: 'teams' as const,
      period: query.period,
      mode: query.mode,
      since,
      rows: rows.flatMap((r, i) => {
        const team = byId.get(r.teamId as string)
        if (!team) return []
        return [{ rank: i + 1, team: { id: team.id, slug: team.slug, name: team.name, school: team.school, color: team.teamColor }, fighters: fighters.get(team.id) ?? 0, ...totals(r) }]
      }),
    }
  }

  const teamSelect = { select: { id: true, name: true, teamColor: true } } as const
  if (query.period === 'all' && query.mode === 'all' && !query.teamId) {
    const players = await prisma.arenaPlayer.findMany({
      where: { matches: { gt: 0 } },
      orderBy: [{ wins: 'desc' }, { knockouts: 'desc' }, { matches: 'asc' }],
      take: query.limit,
      include: { team: teamSelect },
    })
    return {
      board: 'players' as const,
      period: query.period,
      mode: query.mode,
      since,
      rows: players.map((p, i) => ({
        rank: i + 1,
        handle: p.handle,
        team: p.team ? { id: p.team.id, name: p.team.name, color: p.team.teamColor } : null,
        matches: p.matches,
        wins: p.wins,
        roundsWon: p.roundsWon,
        knockouts: p.knockouts,
        damage: p.damage,
      })),
    }
  }

  const rows = await prisma.arenaMatch.groupBy({
    by: ['playerId'],
    where,
    _count: { _all: true },
    _sum: sum,
    orderBy: [{ _sum: { win: 'desc' } }, { _sum: { knockouts: 'desc' } }],
    take: query.limit,
  })
  const players = await prisma.arenaPlayer.findMany({
    where: { id: { in: rows.map((r) => r.playerId) } },
    include: { team: teamSelect },
  })
  const byId = new Map(players.map((p) => [p.id, p]))
  return {
    board: 'players' as const,
    period: query.period,
    mode: query.mode,
    since,
    rows: rows.flatMap((r, i) => {
      const p = byId.get(r.playerId)
      if (!p) return []
      return [{ rank: i + 1, handle: p.handle, team: p.team ? { id: p.team.id, name: p.team.name, color: p.team.teamColor } : null, ...totals(r) }]
    }),
  }
}
