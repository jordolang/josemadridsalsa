import { describe, it, expect, vi } from 'vitest'

const findMany = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findMany: (...args: unknown[]) => findMany(...args) } } }))

import { RECEIPT_BATCH, RECEIPT_LOOKBACK_MS, loadReceipts, receiptWindowStart } from '@/lib/admin-desktop/fulfil'

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

describe('loadReceipts', () => {
  const now = new Date('2026-10-09T12:00:00Z')

  function order(id: string, updatedAt: Date) {
    return {
      id,
      orderNumber: id.toUpperCase(),
      createdAt: updatedAt,
      updatedAt,
      salesChannel: 'ONLINE',
      fundraiser: null,
      user: null,
      guestEmail: null,
      guestPhone: null,
      shippingAddress: null,
      shippingMethod: null,
      items: [],
      subtotal: 0,
      shippingCost: 0,
      tax: 0,
      discountAmount: 0,
      giftCertificateAmount: 0,
      total: 0,
      customerNotes: null,
    }
  }

  it('hands back every order sharing the time a full batch stopped at', async () => {
    const shared = new Date('2026-10-09T11:00:00Z')
    const batch = Array.from({ length: RECEIPT_BATCH }, (_, index) =>
      order(`o${index}`, index < RECEIPT_BATCH - 1 ? new Date(shared.getTime() - 1000) : shared),
    )
    findMany.mockReset().mockResolvedValueOnce(batch).mockResolvedValueOnce([order('tie', shared)])

    const result = await loadReceipts(null, now)

    expect(result.more).toBe(true)
    expect(result.next).toEqual(shared)
    expect(result.receipts.map((receipt) => receipt.orderId)).toContain('tie')
    expect(findMany.mock.calls[1][0].where).toMatchObject({ updatedAt: shared, id: { notIn: batch.map((o) => o.id) } })
  })

  it('starts the next poll at now when the batch is not full', async () => {
    findMany.mockReset().mockResolvedValueOnce([order('o1', new Date('2026-10-09T11:00:00Z'))])
    const result = await loadReceipts(null, now)
    expect(result).toMatchObject({ more: false, next: now })
    expect(findMany).toHaveBeenCalledTimes(1)
  })
})
