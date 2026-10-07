import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: { fundraiser: { findMany: vi.fn().mockRejectedValue(new Error('Environment variable not found: DATABASE_URL')) } },
}))

import { ActiveCampaignsGrid } from '@/components/fundraiser/active-campaigns-grid'

describe('ActiveCampaignsGrid', () => {
  it('renders nothing instead of failing the page when the database is unreachable', async () => {
    await expect(ActiveCampaignsGrid({})).resolves.toBeNull()
  })
})
