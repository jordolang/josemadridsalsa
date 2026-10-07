/**
 * Battle Arena game results and leaderboards.
 *
 * Against the CPU the game opens a match when the fight starts and closes it with the player's
 * result when it ends. Closing applies the result to the player's running totals in the same
 * transaction, and only an open match can be closed, so a result is counted once however often
 * it is sent. Those results are the player's own word, so they stay off the main boards.
 *
 * Against other people only the host reports (see `ArenaHostedMatch`): it opens the match,
 * each other player claims their seat with their own sign-in, and the host reports every
 * seat's result in one go. Those results are what the leaderboards rank.
 */
import type { ArenaPlayer, Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { ArenaGameError } from './http'
import {
  MATCH_MAX_HOURS,
  MATCH_STARTS_PER_HOUR,
  PROVISIONAL_GAMES,
  eloDeltas,
  hashSessionToken,
  implausibleReport,
  implausibleResult,
  modesFor,
  newSeatTicket,
  periodStart,
  type FinishMatchInput,
  type HostedMatchInput,
  type HostedReportInput,
  type LeaderboardQuery,
  type StartMatchInput,
} from './rules'

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}

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

/**
 * The host opens an online match. Its own seat is claimed at once; every other player seat gets
 * a ticket, returned only here, which the host passes to that player alone.
 */
export async function openHostedMatch(host: ArenaPlayer, input: HostedMatchInput) {
  const recent = await prisma.arenaHostedMatch.count({
    where: { hostPlayerId: host.id, startedAt: { gt: new Date(Date.now() - 3_600_000) } },
  })
  if (recent >= MATCH_STARTS_PER_HOUR) {
    throw new ArenaGameError('That is a lot of fights for one hour. Take a breather and come back soon.', 429, 'rate_limited')
  }
  const now = new Date()
  const tickets: Record<number, string> = {}
  const seats = input.seats.map((seat, i) => {
    const fighter = input.seatFighters?.[i] ?? null
    if (seat === input.hostSeat) return { seat, playerId: host.id, teamId: host.teamId, fighter: input.fighter ?? fighter, claimedAt: now }
    const ticket = newSeatTicket()
    tickets[seat] = ticket
    return { seat, ticketHash: hashSessionToken(ticket), fighter }
  })
  const match = await prisma.arenaHostedMatch.create({
    data: { hostPlayerId: host.id, mode: input.mode, room: input.room ?? null, fighters: input.fighters, startedAt: now, seats: { create: seats } },
    select: { id: true, startedAt: true },
  })
  return { matchId: match.id, startedAt: match.startedAt, tickets }
}

/** A player claims the seat their ticket names, with their own sign-in. Claiming again is a no-op. */
export async function joinHostedMatch(player: ArenaPlayer, matchId: string, input: { ticket: string; fighter?: string | null }) {
  const seat = await prisma.arenaHostedSeat.findUnique({
    where: { ticketHash: hashSessionToken(input.ticket) },
    include: { hostedMatch: { select: { id: true, hostPlayerId: true, startedAt: true, reportedAt: true } } },
  })
  if (!seat || seat.hostedMatchId !== matchId) throw new ArenaGameError('That seat ticket is not for this match.', 404)
  if (seat.playerId === player.id) return { ok: true, seat: seat.seat }
  const match = seat.hostedMatch
  if (match.hostPlayerId === player.id) throw new ArenaGameError('The host already has a seat in this match.', 403, 'rejected')
  if (match.reportedAt) throw new ArenaGameError('That match is already over.', 409, 'rejected')
  if (Date.now() - match.startedAt.getTime() > MATCH_MAX_HOURS * 3_600_000) throw new ArenaGameError('That match is too old to join.', 409, 'rejected')
  try {
    const claimed = await prisma.arenaHostedSeat.updateMany({
      where: { id: seat.id, playerId: null },
      data: { playerId: player.id, teamId: player.teamId, fighter: input.fighter ?? seat.fighter, claimedAt: new Date() },
    })
    if (claimed.count === 0) throw new ArenaGameError('Someone already claimed that seat.', 409, 'rejected')
  } catch (error) {
    if (isUniqueViolation(error)) throw new ArenaGameError('You already have a seat in this match.', 409, 'rejected')
    throw error
  }
  return { ok: true, seat: seat.seat }
}

/**
 * The host reports every seat's result, once. Each claimed seat gets its result recorded for
 * the player who claimed it; unclaimed seats (players who were not signed in) are dropped.
 * A match with at least two signed-in players is `verified` and counts on the boards. A ranked
 * 1v1 with both seats claimed and one winner moves both ratings.
 */
export async function reportHostedMatch(host: ArenaPlayer, matchId: string, input: HostedReportInput) {
  const match = await prisma.arenaHostedMatch.findUnique({ where: { id: matchId }, include: { seats: true } })
  if (!match) throw new ArenaGameError('No such match.', 404)
  if (match.hostPlayerId !== host.id) throw new ArenaGameError('Only the host can report this match.', 403, 'rejected')
  if (match.reportedAt) throw new ArenaGameError('Already recorded.', 409, 'rejected')
  const problem = implausibleReport(input, match)
  if (problem) throw new ArenaGameError(problem, 422, 'rejected')

  const bySeat = new Map(match.seats.filter((s) => s.playerId).map((s) => [s.seat, s]))
  const lines = input.results.flatMap((r) => {
    const seat = bySeat.get(r.seat)
    return seat?.playerId ? [{ result: r, seat, playerId: seat.playerId }] : []
  })
  const verified = lines.length >= 2
  const ranked = match.mode === 'RANKED' && verified && lines.length === 2 && lines.filter((l) => l.result.won).length === 1
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    // The unreported condition makes a repeated or concurrent report a no-op.
    const closed = await tx.arenaHostedMatch.updateMany({ where: { id: match.id, reportedAt: null }, data: { reportedAt: now } })
    if (closed.count === 0) throw new ArenaGameError('Already recorded.', 409, 'rejected')
    const players = await tx.arenaPlayer.findMany({
      where: { id: { in: lines.map((l) => l.playerId) } },
      select: { id: true, handle: true, currentStreak: true, bestStreak: true, rating: true, rankedGames: true },
    })
    const byId = new Map(players.map((p) => [p.id, p]))
    const ratingDelta = new Map<string, number>()
    if (ranked) {
      const winner = lines.find((l) => l.result.won)!
      const loser = lines.find((l) => !l.result.won)!
      const [gain, loss] = eloDeltas(byId.get(winner.playerId)!.rating, byId.get(loser.playerId)!.rating)
      ratingDelta.set(winner.playerId, gain)
      ratingDelta.set(loser.playerId, loss)
    }

    const recorded = []
    for (const { result, seat, playerId } of lines) {
      const p = byId.get(playerId)
      if (!p) continue
      const win = result.won ? 1 : 0
      const damage = Math.round(result.damage)
      const streak = win ? p.currentStreak + 1 : 0
      const delta = ratingDelta.get(playerId)
      await tx.arenaMatch.create({
        data: {
          playerId,
          teamId: seat.teamId,
          mode: match.mode,
          fighter: result.fighter ?? seat.fighter,
          opponents: match.fighters - 1,
          room: match.room,
          startedAt: match.startedAt,
          finishedAt: now,
          win,
          roundsWon: result.roundsWon,
          knockouts: result.knockouts,
          damage,
          hostedMatchId: match.id,
          verified,
          ratingDelta: delta ?? null,
        },
      })
      await tx.arenaPlayer.update({
        where: { id: playerId },
        data: {
          matches: { increment: 1 },
          wins: { increment: win },
          roundsWon: { increment: result.roundsWon },
          knockouts: { increment: result.knockouts },
          damage: { increment: damage },
          currentStreak: streak,
          bestStreak: Math.max(p.bestStreak, streak),
          lastPlayedAt: now,
          ...(verified ? { versusMatches: { increment: 1 }, versusWins: { increment: win }, versusKnockouts: { increment: result.knockouts } } : {}),
          ...(delta !== undefined ? { rating: p.rating + delta, rankedGames: { increment: 1 } } : {}),
        },
      })
      recorded.push({
        seat: seat.seat,
        handle: p.handle,
        streak,
        ...(delta !== undefined ? { rating: p.rating + delta, ratingDelta: delta, provisional: p.rankedGames + 1 < PROVISIONAL_GAMES } : {}),
      })
    }
    return { recorded, verified }
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
 * players' matches. Boards sum the verified match history; `rating` ranks ranked ratings.
 */
export async function leaderboard(query: LeaderboardQuery, now = new Date()) {
  const since = periodStart(query.period, now)
  const teamSelect = { select: { id: true, name: true, teamColor: true } } as const

  if (query.board === 'rating') {
    const players = await prisma.arenaPlayer.findMany({
      where: { rankedGames: { gt: 0 }, ...(query.teamId ? { teamId: query.teamId } : {}) },
      orderBy: [{ rating: 'desc' }, { rankedGames: 'desc' }],
      take: query.limit,
      include: { team: teamSelect },
    })
    return {
      board: 'rating' as const,
      period: 'all' as const,
      mode: 'ranked' as const,
      since: null,
      rows: players.map((p, i) => ({
        rank: i + 1,
        handle: p.handle,
        team: p.team ? { id: p.team.id, name: p.team.name, color: p.team.teamColor } : null,
        rating: p.rating,
        rankedGames: p.rankedGames,
        provisional: p.rankedGames < PROVISIONAL_GAMES,
      })),
    }
  }

  // Only host-reported matches between signed-in players count, except on the CPU board.
  const where: Prisma.ArenaMatchWhereInput = {
    finishedAt: since ? { gte: since } : { not: null },
    mode: { in: modesFor(query.mode) },
    ...(query.mode === 'cpu' ? {} : { verified: true }),
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
