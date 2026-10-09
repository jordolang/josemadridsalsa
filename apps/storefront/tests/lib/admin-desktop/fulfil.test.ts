import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { RECEIPT_LOOKBACK_MS, receiptWindowStart } from '@/lib/admin-desktop/fulfil'

describe('receiptWindowStart', () => {
  const now = new Date('2026-10-09T12:00:00Z')

  it('starts where the last poll stopped', () => {
    const since = new Date('2026-10-09T11:59:00Z')
    expect(receiptWindowStart(since, now)).toEqual(since)
  })

  it('never reaches further back than the lookback, or from nothing', () => {
    const floor = new Date(now.getTime() - RECEIPT_LOOKBACK_MS)
    expect(receiptWindowStart(new Date('2025-01-01T00:00:00Z'), now)).toEqual(floor)
    expect(receiptWindowStart(null, now)).toEqual(floor)
  })
})
