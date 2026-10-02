import { beforeEach, describe, expect, it, vi } from 'vitest'

const seasonFindUnique = vi.fn()
const teamFindMany = vi.fn()
const saleGroupBy = vi.fn()
const characterFindMany = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    fundraiserSeason: { findUnique: seasonFindUnique },
    fundraiserTeam: { findMany: teamFindMany },
    fundraiserSaleEvent: { groupBy: saleGroupBy },
    fundraiserCharacter: { findMany: characterFindMany },
  }
  return { prisma: client, default: client }
})

const { getBattleStandings } = await import('@/lib/arena/standings')

const team = (id: string, createdAt: string) => ({
  id, slug: id, name: id, school: `${id} HS`, logoUrl: null, createdAt: new Date(createdAt),
})

describe('getBattleStandings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    characterFindMany.mockResolvedValue([])
  })

  it("uses the season's own roster when the period has a season, not every team in the period", async () => {
    seasonFindUnique.mockResolvedValue({ id: 'season-oct' })
    teamFindMany.mockResolvedValue([])
    await getBattleStandings('2026-10')
    expect(teamFindMany.mock.calls[0][0].where).toEqual({ status: 'ACTIVE', seasonId: 'season-oct' })
  })

  it('falls back to the period when there is no season', async () => {
    seasonFindUnique.mockResolvedValue(null)
    teamFindMany.mockResolvedValue([])
    await getBattleStandings('2026-10')
    expect(teamFindMany.mock.calls[0][0].where).toEqual({ status: 'ACTIVE', activePeriod: '2026-10' })
  })

  it("ranks by this battle's sale events, never the lifetime salesCount, earliest team on a tie", async () => {
    seasonFindUnique.mockResolvedValue(null)
    teamFindMany.mockResolvedValue([team('veteran', '2026-01-01'), team('early', '2026-10-01'), team('late', '2026-10-05')])
    saleGroupBy
      .mockResolvedValueOnce([
        { teamId: 'early', _count: { _all: 4 }, _sum: { amount: 40 } },
        { teamId: 'late', _count: { _all: 4 }, _sum: { amount: 55.5 } },
        { teamId: 'veteran', _count: { _all: 1 }, _sum: { amount: 10 } },
      ])
      .mockResolvedValueOnce([])

    const standings = await getBattleStandings('2026-10')

    expect(saleGroupBy.mock.calls[0][0].where).toMatchObject({ period: '2026-10' })
    expect(standings.map((s) => [s.id, s.battleSales, s.battleRaised])).toEqual([
      ['early', 4, 40],
      ['late', 4, 55.5],
      ['veteran', 1, 10],
    ])
  })

  it("names each team's top seller from exact sale amounts in this battle", async () => {
    seasonFindUnique.mockResolvedValue(null)
    teamFindMany.mockResolvedValue([team('t1', '2026-10-01')])
    saleGroupBy
      .mockResolvedValueOnce([{ teamId: 't1', _count: { _all: 3 }, _sum: { amount: 30.5 } }])
      .mockResolvedValueOnce([
        { teamId: 't1', sellingCharacterId: 'c1', _sum: { amount: 10.25 } },
        { teamId: 't1', sellingCharacterId: 'c2', _sum: { amount: 10.75 } },
      ])
    characterFindMany.mockResolvedValue([
      { id: 'c1', characterName: 'Ava' },
      { id: 'c2', characterName: 'Ben' },
    ])

    const [standing] = await getBattleStandings('2026-10')
    expect(standing.topSeller).toEqual({ name: 'Ben', raised: 10.75 })
  })
})
