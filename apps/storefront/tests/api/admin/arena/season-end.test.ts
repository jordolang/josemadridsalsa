import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const seasonFindUnique = vi.fn()
const championshipUpsert = vi.fn()
const seasonUpdate = vi.fn()
const getBattleStandings = vi.fn()

vi.mock('@/lib/admin-auth', () => ({ requireAdminSession: vi.fn().mockResolvedValue({ id: 'admin' }) }))
vi.mock('@/lib/arena/standings', () => ({ getBattleStandings }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(), logAuditWithRequest: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const tx = { fundraiserSeason: { update: seasonUpdate }, fundraiserChampionship: { upsert: championshipUpsert } }
  const client = {
    fundraiserSeason: { findUnique: seasonFindUnique },
    fundraiserChampionship: { findFirst: vi.fn() },
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  }
  return { prisma: client, default: client }
})

const { POST } = await import('@/app/api/admin/arena/seasons/[id]/end/route')

const end = () =>
  POST(
    new NextRequest('http://localhost/api/admin/arena/seasons/s1/end', {
      method: 'POST',
      body: JSON.stringify({ prizeAmount: 1000, scholarshipAmount: 1000 }),
    }),
    { params: Promise.resolve({ id: 's1' }) },
  )

describe('ending a season', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seasonFindUnique.mockResolvedValue({ id: 's1', period: '2026-10', status: 'ACTIVE', championTeamId: null })
    seasonUpdate.mockResolvedValue({ id: 's1' })
    championshipUpsert.mockImplementation(({ create }) => Promise.resolve({ id: 'c1', ...create }))
  })

  it("crowns the leader of this battle's standings, from the season's roster", async () => {
    getBattleStandings.mockResolvedValue([
      { id: 'eagles', slug: 'eagles', name: 'Eagles', battleSales: 7 },
      { id: 'hawks', slug: 'hawks', name: 'Hawks', battleSales: 3 },
    ])

    const res = await end()

    expect(res.status).toBe(200)
    expect(getBattleStandings).toHaveBeenCalledWith('2026-10', { seasonId: 's1', status: 'ACTIVE' })
    expect(seasonUpdate.mock.calls[0][0].data).toMatchObject({ status: 'ENDED', championTeamId: 'eagles' })
    expect(championshipUpsert.mock.calls[0][0].create).toMatchObject({ month: 10, year: 2026, winningFundraiserId: 'eagles' })
  })

  it('crowns nobody when no sales were made during the battle', async () => {
    getBattleStandings.mockResolvedValue([{ id: 'eagles', slug: 'eagles', name: 'Eagles', battleSales: 0 }])
    await end()
    expect(seasonUpdate.mock.calls[0][0].data).toMatchObject({ championTeamId: null })
    expect(championshipUpsert).not.toHaveBeenCalled()
  })
})
