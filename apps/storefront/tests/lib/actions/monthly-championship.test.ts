import { beforeEach, describe, expect, it, vi } from 'vitest'

const getBattleStandings = vi.fn()
const championshipFindMany = vi.fn()

vi.mock('@/lib/arena/standings', () => ({ getBattleStandings }))
vi.mock('@/lib/prisma', () => {
  const client = { fundraiserChampionship: { findMany: championshipFindMany } }
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

  it('shows the same standings the season-end route crowns from', async () => {
    getBattleStandings.mockResolvedValue([
      { id: 't1', slug: 'eagles', name: 'Eagles', school: 'North HS', logoUrl: null, createdAt: new Date(), battleSales: 7, battleRaised: 70.5, topSeller: { name: 'Ava', raised: 40.25 } },
    ])

    const result = await getMonthlyChampionship(10, 2026)

    expect(getBattleStandings).toHaveBeenCalledWith('2026-10')
    expect(result.currentLeaderboard).toEqual([
      { id: 't1', slug: 'eagles', name: 'Eagles', organizationName: 'North HS', logoUrl: null, salesCount: 7, totalRevenue: 70.5, topParticipant: { name: 'Ava', revenue: 40.25 } },
    ])
  })

  it('refuses a nonsense month', async () => {
    await expect(getMonthlyChampionship(13, 2026)).rejects.toThrow('Invalid month')
  })
})
