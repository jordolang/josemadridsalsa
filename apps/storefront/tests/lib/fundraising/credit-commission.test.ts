import { describe, expect, it, vi } from 'vitest'

import { creditFundraiserCommission } from '@/lib/fundraising/credit-commission'

/**
 * A stand-in transaction client. The interesting behaviour here is which branch is taken and
 * whether the rollups are touched at all, so the fake reports what was called rather than
 * pretending to be a database.
 */
function fakeTx({
  order,
  commissionRate = 50,
  claimCount = 1,
  fundraiserExists = true,
}: {
  order: Record<string, unknown> | null
  commissionRate?: number
  claimCount?: number
  fundraiserExists?: boolean
}) {
  const participantUpdate = vi.fn().mockResolvedValue({})
  const fundraiserUpdate = vi.fn().mockResolvedValue({})

  return {
    tx: {
      order: {
        findUnique: vi.fn().mockResolvedValue(order),
        updateMany: vi.fn().mockResolvedValue({ count: claimCount }),
      },
      fundraiser: {
        findUnique: vi.fn().mockResolvedValue(fundraiserExists ? { commissionRate } : null),
        update: fundraiserUpdate,
      },
      fundraiserParticipant: { update: participantUpdate },
      // Only the handful of calls this function makes are stubbed, so the shape is narrowed
      // to the parameter type rather than pretending to be a whole Prisma client.
    } as unknown as Parameters<typeof creditFundraiserCommission>[0],
    participantUpdate,
    fundraiserUpdate,
  }
}

const fundraiserOrder = {
  subtotal: 60,
  discountAmount: 0,
  total: 70.15,
  participantId: 'participant-1',
  fundraiserId: 'fundraiser-1',
  commissionCreditedAt: null,
}

describe('creditFundraiserCommission', () => {
  it('credits the participant and the fundraiser from the merchandise subtotal', async () => {
    const { tx, participantUpdate, fundraiserUpdate } = fakeTx({ order: fundraiserOrder })

    const result = await creditFundraiserCommission(tx, 'order-1')

    // Half of $60 of goods, not half of the $70.15 that included freight and tax.
    expect(result).toEqual({ credited: true, amount: 30 })
    expect(participantUpdate).toHaveBeenCalledOnce()
    expect(fundraiserUpdate).toHaveBeenCalledOnce()

    // Revenue is the whole order; commission is the group's share of the goods.
    const data = fundraiserUpdate.mock.calls[0][0].data
    expect(Number(data.totalRevenue.increment)).toBe(70.15)
    expect(Number(data.totalCommission.increment)).toBe(30)
    expect(data.totalOrders).toEqual({ increment: 1 })
  })

  it('credits the group for a sale made on the campaign page itself', async () => {
    // No referral code, so no student to attribute it to. The school is still owed its half:
    // requiring a participant is what used to leave these sales uncredited entirely.
    const { tx, participantUpdate, fundraiserUpdate } = fakeTx({
      order: { ...fundraiserOrder, participantId: null },
    })

    const result = await creditFundraiserCommission(tx, 'order-1')

    expect(result).toEqual({ credited: true, amount: 30 })
    expect(participantUpdate).not.toHaveBeenCalled()
    expect(fundraiserUpdate).toHaveBeenCalledOnce()
  })

  it('does nothing for an order that is not a fundraiser sale', async () => {
    const { tx, participantUpdate, fundraiserUpdate } = fakeTx({
      order: { ...fundraiserOrder, participantId: null, fundraiserId: null },
    })

    const result = await creditFundraiserCommission(tx, 'order-1')

    expect(result.credited).toBe(false)
    expect(result.reason).toBe('not-a-fundraiser-order')
    expect(participantUpdate).not.toHaveBeenCalled()
    expect(fundraiserUpdate).not.toHaveBeenCalled()
  })

  it('does nothing for an order already credited', async () => {
    const { tx, fundraiserUpdate } = fakeTx({
      order: { ...fundraiserOrder, commissionCreditedAt: new Date() },
    })

    const result = await creditFundraiserCommission(tx, 'order-1')

    expect(result.reason).toBe('already-credited')
    expect(fundraiserUpdate).not.toHaveBeenCalled()
  })

  it('pays nothing when it loses the claim to a concurrent caller', async () => {
    // Both callers read a null column; only one update matches. This is the webhook racing
    // the completion route, and the loser must not credit a second time.
    const { tx, participantUpdate, fundraiserUpdate } = fakeTx({
      order: fundraiserOrder,
      claimCount: 0,
    })

    const result = await creditFundraiserCommission(tx, 'order-1')

    expect(result).toEqual({ credited: false, amount: 0, reason: 'already-credited' })
    expect(participantUpdate).not.toHaveBeenCalled()
    expect(fundraiserUpdate).not.toHaveBeenCalled()
  })

  it('claims the order and records the amount in one write', async () => {
    const { tx } = fakeTx({ order: fundraiserOrder })

    await creditFundraiserCommission(tx, 'order-1')

    // The guard is what makes the claim atomic rather than a read-then-write, and the amount
    // rides along so it can never be credited without being recorded.
    const call = tx.order.updateMany.mock.calls[0][0]
    expect(call.where).toEqual({ id: 'order-1', commissionCreditedAt: null })
    expect(Number(call.data.fundraiserCommission)).toBe(30)
    expect(call.data.commissionCreditedAt).toBeInstanceOf(Date)
  })

  it('records nothing on the order when it loses the claim', async () => {
    const { tx } = fakeTx({ order: fundraiserOrder, claimCount: 0 })

    await creditFundraiserCommission(tx, 'order-1')

    // The losing write matched no rows, so the winner's amount stands.
    expect(tx.order.updateMany).toHaveBeenCalledOnce()
  })

  it('does not credit when the fundraiser row has gone', async () => {
    const { tx, participantUpdate } = fakeTx({ order: fundraiserOrder, fundraiserExists: false })

    const result = await creditFundraiserCommission(tx, 'order-1')

    expect(result.reason).toBe('fundraiser-missing')
    expect(participantUpdate).not.toHaveBeenCalled()
  })

  it('takes discounts off the base but leaves revenue whole', async () => {
    const { tx, fundraiserUpdate } = fakeTx({
      order: { ...fundraiserOrder, subtotal: 60, discountAmount: 10, total: 60.15 },
    })

    const result = await creditFundraiserCommission(tx, 'order-1')

    expect(result.amount).toBe(25)
    expect(Number(fundraiserUpdate.mock.calls[0][0].data.totalRevenue.increment)).toBe(60.15)
  })
})
