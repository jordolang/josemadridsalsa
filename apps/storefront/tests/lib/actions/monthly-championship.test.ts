import { beforeEach, describe, expect, it, vi } from 'vitest'

const teamFindMany = vi.fn()
const saleGroupBy = vi.fn()
const championshipFindMany = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    fundraiserTeam: { findMany: teamFindMany },
    fundraiserSaleEvent: { groupBy: saleGroupBy },
    fundraiserChampionship: { findMany: championshipFindMany },
  }
  return { prisma: client, default: client }
})
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { getMonthlyChampionship } = await import('@/lib/actions/social-features')

describe('getMonthlyChampionship', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    championshipFindMany.mockResolvedValue([])
  })

  it('ranks the month’s battle teams the way the season-end route crowns the champion', async () => {
    teamFindMany.mockResolvedValue([])
    await getMonthlyChampionship(10, 2026)

    expect(teamFindMany.mock.calls[0][0].where).toEqual({ status: 'ACTIVE', activePeriod: '2026-10' })
    expect(teamFindMany.mock.calls[0][0].orderBy).toEqual([{ salesCount: 'desc' }, { createdAt: 'asc' }])
    expect(saleGroupBy).not.toHaveBeenCalled()
  })

  it('reports this month’s battle takings per team, not all-time revenue', async () => {
    teamFindMany.mockResolvedValue([
      { id: 't1', slug: 'eagles', name: 'Eagles', school: 'North HS', logoUrl: null, salesCount: 7, characters: [{ characterName: 'Ava', amountRaised: 40 }] },
      { id: 't2', slug: 'hawks', name: 'Hawks', school: 'South HS', logoUrl: null, salesCount: 3, characters: [] },
    ])
    saleGroupBy.mockResolvedValue([{ teamId: 't1', _sum: { amount: 70 } }])

    const result = await getMonthlyChampionship(10, 2026)

    const window = saleGroupBy.mock.calls[0][0].where.createdAt
    expect(window).toEqual({ gte: new Date('2026-10-01T00:00:00Z'), lt: new Date('2026-11-01T00:00:00Z') })
    expect(result.currentLeaderboard).toEqual([
      expect.objectContaining({ slug: 'eagles', salesCount: 7, totalRevenue: 70, organizationName: 'North HS', topParticipant: { name: 'Ava', revenue: 40 } }),
      expect.objectContaining({ slug: 'hawks', salesCount: 3, totalRevenue: 0, topParticipant: null }),
    ])
  })

  it('refuses a nonsense month', async () => {
    await expect(getMonthlyChampionship(13, 2026)).rejects.toThrow('Invalid month')
  })
})
