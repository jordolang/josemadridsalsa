import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const db = {
    arenaMatch: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), groupBy: vi.fn() },
    arenaPlayer: { findUniqueOrThrow: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    fundraiserTeam: { findMany: vi.fn() },
    $transaction: vi.fn(),
  }
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db))
  return db
})

vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }))

const { startMatch, finishMatch, leaderboard } = await import('@/lib/arena-game/matches')
const { LeaderboardQuerySchema } = await import('@/lib/arena-game/rules')

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
    expect(args.where).toEqual({ finishedAt: { gte: new Date('2026-10-05T00:00:00Z') }, mode: { in: ['ONLINE', 'TOURNAMENT'] } })
    expect(args.orderBy).toEqual([{ _sum: { win: 'desc' } }, { _sum: { knockouts: 'desc' } }])
    expect(board.rows.map((r) => ('handle' in r ? r.handle : ''))).toEqual(['Ben', 'Ana'])
    expect(board.rows[0]).toMatchObject({ rank: 1, wins: 3, knockouts: 9, matches: 3, team: { name: 'Band' } })
  })

  it('reads the all-time player board from the running totals', async () => {
    db.arenaPlayer.findMany.mockResolvedValue([{ id: 'p_1', handle: 'Ana', team: null, matches: 5, wins: 4, roundsWon: 9, knockouts: 12, damage: 900 }])
    const board = await leaderboard(LeaderboardQuerySchema.parse({ period: 'all' }))
    expect(db.arenaMatch.groupBy).not.toHaveBeenCalled()
    expect(board.rows[0]).toMatchObject({ rank: 1, handle: 'Ana', wins: 4 })
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
