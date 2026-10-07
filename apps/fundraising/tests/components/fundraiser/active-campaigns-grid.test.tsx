import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActiveCampaignsGrid } from '@/components/fundraiser/active-campaigns-grid'
import prisma from '@/lib/prisma'

vi.mock('@/lib/prisma', () => {
  const mockPrismaClient = {
    fundraiser: {
      findMany: vi.fn(),
    },
  }
  return { default: mockPrismaClient, prisma: mockPrismaClient }
})

describe('ActiveCampaignsGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders nothing instead of throwing when the database is unavailable', async () => {
    // A preview build with no DATABASE_URL rejects every query; the /fundraising page must still build.
    vi.mocked(prisma.fundraiser.findMany).mockRejectedValue(
      new Error('Environment variable not found: DATABASE_URL.'),
    )

    await expect(ActiveCampaignsGrid({})).resolves.toBeNull()
  })

  it('renders nothing when there are no active campaigns', async () => {
    vi.mocked(prisma.fundraiser.findMany).mockResolvedValue([])

    await expect(ActiveCampaignsGrid({})).resolves.toBeNull()
  })
})
