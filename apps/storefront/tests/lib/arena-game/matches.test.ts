import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const db = {
    arenaMatch: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), groupBy: vi.fn() },
    arenaPlayer: { findUniqueOrThrow: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    arenaHostedMatch: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    arenaHostedSeat: { findUnique: vi.fn(), updateMany: vi.fn() },
    fundraiserTeam: { findMany: vi.fn() },
    $transaction: vi.fn(),
  }
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db))
  return db
})

vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }))

const { startMatch, finishMatch, leaderboard, openHostedMatch, joinHostedMatch, reportHostedMatch } = await import('@/lib/arena-game/matches')
const { LeaderboardQuerySchema, HostedReportSchema, hashSessionToken } = await import('@/lib/arena-game/rules')

const player = { id: 'p_1', userId: 'u_1', teamId: 't_1' } as Parameters<typeof startMatch>[0]
const result = { won: true, roundsWon: 2, rounds: 3, knockouts: 4, damage: 610.6 }

beforeEach(() => {
  vi.clearAllMocks()
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db))
})

describe('startMatch', () => {
  it('opens a match under the player and their group', async () => {
    db.arenaMatch.count.mockResolvedValue(0)
    db.arenaMatch.create.mockResolvedValue({ id: 'm_1', startedAt: new Date() })
    expect((await startMatch(player, { mode: 'CPU', opponents: 3, fighter: 'ember' })).matchId).toBe('m_1')
    expect(db.arenaMatch.create.mock.calls[0][0].data).toMatchObject({ playerId: 'p_1', teamId: 't_1', mode: 'CPU', opponents: 3, fighter: 'ember' })
  })

  it('slows down a flood of matches', async () => {
    db.arenaMatch.count.mockResolvedValue(40)
    await expect(startMatch(player, { mode: 'CPU', opponents: 1 })).rejects.toMatchObject({ status: 429 })
  })
})

describe('finishMatch', () => {
  const open = (over: Record<string, unknown> = {}) => ({ id: 'm_1', playerId: 'p_1', opponents: 3, finishedAt: null, startedAt: new Date(Date.now() - 120_000), ...over })

  it('records the result and adds it to the totals once', async () => {
    db.arenaMatch.findUnique.mockResolvedValue(open())
    db.arenaMatch.updateMany.mockResolvedValue({ count: 1 })
    db.arenaPlayer.findUniqueOrThrow.mockResolvedValue({ currentStreak: 2, bestStreak: 2 })
    expect(await finishMatch(player, 'm_1', result)).toEqual({ recorded: true, streak: 3 })
    expect(db.arenaMatch.updateMany.mock.calls[0][0].where).toEqual({ id: 'm_1', finishedAt: null })
    expect(db.arenaPlayer.update.mock.calls[0][0].data).toMatchObject({
      matches: { increment: 1 },
      wins: { increment: 1 },
      knockouts: { increment: 4 },
      damage: { increment: 611 },
      currentStreak: 3,
      bestStreak: 3,
    })
  })

  it('ends the streak on a loss', async () => {
    db.arenaMatch.findUnique.mockResolvedValue(open())
    db.arenaMatch.updateMany.mockResolvedValue({ count: 1 })
    db.arenaPlayer.findUniqueOrThrow.mockResolvedValue({ currentStreak: 5, bestStreak: 6 })
    await finishMatch(player, 'm_1', { ...result, won: false, roundsWon: 1 })
    expect(db.arenaPlayer.update.mock.calls[0][0].data).toMatchObject({ wins: { increment: 0 }, currentStreak: 0, bestStreak: 6 })
  })

  it('ignores a result sent twice', async () => {
    db.arenaMatch.findUnique.mockResolvedValue(open({ finishedAt: new Date() }))
    expect((await finishMatch(player, 'm_1', result)).recorded).toBe(false)
    db.arenaMatch.findUnique.mockResolvedValue(open())
    db.arenaMatch.updateMany.mockResolvedValue({ count: 0 })
    expect((await finishMatch(player, 'm_1', result)).recorded).toBe(false)
    expect(db.arenaPlayer.update).not.toHaveBeenCalled()
  })

  it("refuses another player's match and impossible results", async () => {
    db.arenaMatch.findUnique.mockResolvedValue(open({ playerId: 'p_2' }))
    await expect(finishMatch(player, 'm_1', result)).rejects.toMatchObject({ status: 404 })
    db.arenaMatch.findUnique.mockResolvedValue(open({ startedAt: new Date() }))
    await expect(finishMatch(player, 'm_1', result)).rejects.toMatchObject({ status: 422 })
  })
})

describe('leaderboard', () => {
  const sums = (win: number, knockouts: number) => ({ _count: { _all: 3 }, _sum: { win, roundsWon: win * 2, knockouts, damage: 100 } })

  it('ranks players over the week by summed wins and knockouts', async () => {
    db.arenaMatch.groupBy.mockResolvedValue([{ playerId: 'p_2', ...sums(3, 9) }, { playerId: 'p_1', ...sums(2, 4) }])
    db.arenaPlayer.findMany.mockResolvedValue([
      { id: 'p_1', handle: 'Ana', team: null },
      { id: 'p_2', handle: 'Ben', team: { id: 't_1', name: 'Band', teamColor: '#f00' } },
    ])
    const board = await leaderboard(LeaderboardQuerySchema.parse({ mode: 'versus' }), new Date('2026-10-07T12:00:00Z'))
    const args = db.arenaMatch.groupBy.mock.calls[0][0]
    expect(args.where).toEqual({ finishedAt: { gte: new Date('2026-10-05T00:00:00Z') }, mode: { in: ['ONLINE', 'TOURNAMENT', 'RANKED'] }, verified: true })
    expect(args.orderBy).toEqual([{ _sum: { win: 'desc' } }, { _sum: { knockouts: 'desc' } }])
    expect(board.rows.map((r) => ('handle' in r ? r.handle : ''))).toEqual(['Ben', 'Ana'])
    expect(board.rows[0]).toMatchObject({ rank: 1, wins: 3, knockouts: 9, matches: 3, team: { name: 'Band' } })
  })

  it('keeps self-reported CPU matches to the CPU board', async () => {
    db.arenaMatch.groupBy.mockResolvedValue([])
    db.arenaPlayer.findMany.mockResolvedValue([])
    await leaderboard(LeaderboardQuerySchema.parse({ period: 'all' }))
    expect(db.arenaMatch.groupBy.mock.calls[0][0].where).toMatchObject({ verified: true, mode: { in: ['ONLINE', 'TOURNAMENT', 'RANKED'] } })
    await leaderboard(LeaderboardQuerySchema.parse({ period: 'all', mode: 'cpu' }))
    expect(db.arenaMatch.groupBy.mock.calls[1][0].where).not.toHaveProperty('verified')
  })

  it('ranks ranked players by rating', async () => {
    db.arenaPlayer.findMany.mockResolvedValue([{ id: 'p_1', handle: 'Ana', team: null, rating: 1060, rankedGames: 12 }])
    const board = await leaderboard(LeaderboardQuerySchema.parse({ board: 'rating' }))
    expect(db.arenaPlayer.findMany.mock.calls[0][0]).toMatchObject({ where: { rankedGames: { gt: 0 } }, orderBy: [{ rating: 'desc' }, { rankedGames: 'desc' }] })
    expect(board.rows[0]).toEqual({ rank: 1, handle: 'Ana', team: null, rating: 1060, rankedGames: 12, provisional: false })
  })

  it('ranks groups and counts their fighters', async () => {
    db.arenaMatch.groupBy
      .mockResolvedValueOnce([{ teamId: 't_1', ...sums(5, 20) }, { teamId: 't_2', ...sums(1, 2) }])
      .mockResolvedValueOnce([
        { teamId: 't_1', playerId: 'p_1' },
        { teamId: 't_1', playerId: 'p_2' },
        { teamId: 't_2', playerId: 'p_3' },
      ])
    db.fundraiserTeam.findMany.mockResolvedValue([
      { id: 't_1', slug: 'band', name: 'Band', school: 'ZHS', teamColor: '#f00' },
      { id: 't_2', slug: 'choir', name: 'Choir', school: 'ZHS', teamColor: '#00f' },
    ])
    const board = await leaderboard(LeaderboardQuerySchema.parse({ board: 'teams', period: 'month' }))
    expect(db.arenaMatch.groupBy.mock.calls[0][0].where.teamId).toEqual({ not: null })
    expect(board.rows).toMatchObject([
      { rank: 1, fighters: 2, wins: 5, team: { name: 'Band' } },
      { rank: 2, fighters: 1, wins: 1, team: { name: 'Choir' } },
    ])
  })
})

describe('hosted matches', () => {
  const host = { id: 'p_1', userId: 'u_1', teamId: 't_1', handle: 'Ana' } as Parameters<typeof openHostedMatch>[0]
  const guest = { id: 'p_2', userId: 'u_2', teamId: 't_2', handle: 'Ben' } as Parameters<typeof openHostedMatch>[0]
  const started = new Date(Date.now() - 120_000)

  it('claims the host seat and hands out a ticket for every other seat', async () => {
    db.arenaHostedMatch.count.mockResolvedValue(0)
    db.arenaHostedMatch.create.mockResolvedValue({ id: 'h_1', startedAt: new Date() })
    const opened = await openHostedMatch(host, { mode: 'ONLINE', fighters: 4, seats: [0, 1, 2], hostSeat: 0, fighter: 'titan' })
    expect(Object.keys(opened.tickets)).toEqual(['1', '2'])
    const seats = db.arenaHostedMatch.create.mock.calls[0][0].data.seats.create
    expect(seats[0]).toMatchObject({ seat: 0, playerId: 'p_1', teamId: 't_1', fighter: 'titan' })
    expect(seats[1]).toEqual({ seat: 1, ticketHash: hashSessionToken(opened.tickets[1]), fighter: null })
    expect(JSON.stringify(seats)).not.toContain(opened.tickets[1])
  })

  describe('joining', () => {
    const seat = (over: Record<string, unknown> = {}) => ({
      id: 's_1', hostedMatchId: 'h_1', seat: 1, playerId: null, fighter: null,
      hostedMatch: { id: 'h_1', hostPlayerId: 'p_1', startedAt: started, reportedAt: null }, ...over,
    })
    const ticket = 'a'.repeat(32)

    it('claims the seat for the signed-in player', async () => {
      db.arenaHostedSeat.findUnique.mockResolvedValue(seat())
      db.arenaHostedSeat.updateMany.mockResolvedValue({ count: 1 })
      expect(await joinHostedMatch(guest, 'h_1', { ticket, fighter: 'volt' })).toEqual({ ok: true, seat: 1 })
      expect(db.arenaHostedSeat.findUnique.mock.calls[0][0].where).toEqual({ ticketHash: hashSessionToken(ticket) })
      expect(db.arenaHostedSeat.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 's_1', playerId: null }, data: { playerId: 'p_2', teamId: 't_2', fighter: 'volt' } })
    })

    it('refuses a ticket for another match, a taken seat, the host and a finished match', async () => {
      db.arenaHostedSeat.findUnique.mockResolvedValue(seat({ hostedMatchId: 'h_2' }))
      await expect(joinHostedMatch(guest, 'h_1', { ticket })).rejects.toMatchObject({ status: 404 })
      db.arenaHostedSeat.findUnique.mockResolvedValue(seat())
      db.arenaHostedSeat.updateMany.mockResolvedValue({ count: 0 })
      await expect(joinHostedMatch(guest, 'h_1', { ticket })).rejects.toMatchObject({ status: 409 })
      await expect(joinHostedMatch(host, 'h_1', { ticket })).rejects.toMatchObject({ status: 403 })
      db.arenaHostedSeat.findUnique.mockResolvedValue(seat({ hostedMatch: { id: 'h_1', hostPlayerId: 'p_1', startedAt: started, reportedAt: new Date() } }))
      await expect(joinHostedMatch(guest, 'h_1', { ticket })).rejects.toMatchObject({ status: 409 })
    })
  })

  describe('reporting', () => {
    const line = (seat: number, won: boolean) => ({ seat, won, roundsWon: won ? 2 : 1, rounds: 3, knockouts: won ? 3 : 1, damage: 500 })
    const report = HostedReportSchema.parse({ rounds: 3, winnerSeat: 0, results: [line(0, true), line(1, false), line(2, false)] })
    const hosted = (over: Record<string, unknown> = {}) => ({
      id: 'h_1', hostPlayerId: 'p_1', mode: 'ONLINE', room: 'WQ4DE', fighters: 4, startedAt: started, reportedAt: null,
      seats: [
        { seat: 0, playerId: 'p_1', teamId: 't_1', fighter: 'titan' },
        { seat: 1, playerId: 'p_2', teamId: 't_2', fighter: 'volt' },
        { seat: 2, playerId: null, teamId: null, fighter: null },
      ],
      ...over,
    })
    const players = [
      { id: 'p_1', handle: 'Ana', currentStreak: 1, bestStreak: 3, rating: 1000, rankedGames: 0 },
      { id: 'p_2', handle: 'Ben', currentStreak: 2, bestStreak: 2, rating: 1000, rankedGames: 0 },
    ]

    it('records every claimed seat once, as verified, and drops unclaimed seats', async () => {
      db.arenaHostedMatch.findUnique.mockResolvedValue(hosted())
      db.arenaHostedMatch.updateMany.mockResolvedValue({ count: 1 })
      db.arenaPlayer.findMany.mockResolvedValue(players)
      const out = await reportHostedMatch(host, 'h_1', report)
      expect(out).toEqual({ verified: true, recorded: [{ seat: 0, handle: 'Ana', streak: 2 }, { seat: 1, handle: 'Ben', streak: 0 }] })
      expect(db.arenaHostedMatch.updateMany.mock.calls[0][0].where).toEqual({ id: 'h_1', reportedAt: null })
      expect(db.arenaMatch.create).toHaveBeenCalledTimes(2)
      expect(db.arenaMatch.create.mock.calls[1][0].data).toMatchObject({ playerId: 'p_2', teamId: 't_2', mode: 'ONLINE', win: 0, hostedMatchId: 'h_1', verified: true, opponents: 3 })
      expect(db.arenaPlayer.update.mock.calls[0][0].data).toMatchObject({ wins: { increment: 1 }, versusWins: { increment: 1 }, versusMatches: { increment: 1 } })
      expect(db.arenaPlayer.update.mock.calls[0][0].data).not.toHaveProperty('rating')
    })

    it('keeps a host-only match off the boards', async () => {
      db.arenaHostedMatch.findUnique.mockResolvedValue(hosted({ seats: [{ seat: 0, playerId: 'p_1', teamId: 't_1', fighter: 'titan' }] }))
      db.arenaHostedMatch.updateMany.mockResolvedValue({ count: 1 })
      db.arenaPlayer.findMany.mockResolvedValue([players[0]])
      expect((await reportHostedMatch(host, 'h_1', report)).verified).toBe(false)
      expect(db.arenaMatch.create.mock.calls[0][0].data.verified).toBe(false)
      expect(db.arenaPlayer.update.mock.calls[0][0].data).not.toHaveProperty('versusWins')
    })

    it('moves both ratings in a ranked 1v1', async () => {
      db.arenaHostedMatch.findUnique.mockResolvedValue(hosted({ mode: 'RANKED', fighters: 2, seats: hosted().seats.slice(0, 2) }))
      db.arenaHostedMatch.updateMany.mockResolvedValue({ count: 1 })
      db.arenaPlayer.findMany.mockResolvedValue(players)
      const out = await reportHostedMatch(host, 'h_1', HostedReportSchema.parse({ rounds: 3, winnerSeat: 0, results: [line(0, true), line(1, false)] }))
      expect(out.recorded).toEqual([
        { seat: 0, handle: 'Ana', streak: 2, rating: 1016, ratingDelta: 16, provisional: true },
        { seat: 1, handle: 'Ben', streak: 0, rating: 984, ratingDelta: -16, provisional: true },
      ])
      expect(db.arenaPlayer.update.mock.calls[1][0].data).toMatchObject({ rating: 984, rankedGames: { increment: 1 } })
      expect(db.arenaMatch.create.mock.calls[0][0].data.ratingDelta).toBe(16)
    })

    it('takes a report only from the host, only once', async () => {
      db.arenaHostedMatch.findUnique.mockResolvedValue(hosted())
      await expect(reportHostedMatch(guest, 'h_1', report)).rejects.toMatchObject({ status: 403 })
      db.arenaHostedMatch.findUnique.mockResolvedValue(hosted({ reportedAt: new Date() }))
      await expect(reportHostedMatch(host, 'h_1', report)).rejects.toMatchObject({ status: 409 })
      db.arenaHostedMatch.findUnique.mockResolvedValue(hosted())
      db.arenaHostedMatch.updateMany.mockResolvedValue({ count: 0 })
      await expect(reportHostedMatch(host, 'h_1', report)).rejects.toMatchObject({ status: 409 })
      expect(db.arenaMatch.create).not.toHaveBeenCalled()
    })

    it('rejects an impossible report', async () => {
      db.arenaHostedMatch.findUnique.mockResolvedValue(hosted({ startedAt: new Date() }))
      await expect(reportHostedMatch(host, 'h_1', report)).rejects.toMatchObject({ status: 422 })
    })
  })
})
