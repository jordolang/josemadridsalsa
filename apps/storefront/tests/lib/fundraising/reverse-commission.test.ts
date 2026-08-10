import { describe, expect, it, vi } from 'vitest'

import { reverseFundraiserCommission } from '@/lib/fundraising/reverse-commission'

/** A stand-in transaction client; the fake reports what was called rather than storing rows. */
function fakeTx({
  refund,
  priorReversals = 0,
  claimCount = 1,
}: {
  refund: Record<string, unknown> | null
  priorReversals?: number
  claimCount?: number
}) {
  const orderUpdate = vi.fn().mockResolvedValue({})
  const participantUpdate = vi.fn().mockResolvedValue({})
  const fundraiserUpdate = vi.fn().mockResolvedValue({})
  const updateMany = vi.fn().mockResolvedValue({ count: claimCount })

  return {
    tx: {
      refund: {
        findUnique: vi.fn().mockResolvedValue(refund),
        updateMany,
        aggregate: vi.fn().mockResolvedValue({ _sum: { commissionReversed: priorReversals } }),
      },
      order: { update: orderUpdate },
      fundraiserParticipant: { update: participantUpdate },
      fundraiser: { update: fundraiserUpdate },
    } as unknown as Parameters<typeof reverseFundraiserCommission>[0],
    orderUpdate,
    participantUpdate,
    fundraiserUpdate,
    updateMany,
  }
}

/** $60 of jars credited at 50% = $30. Order total was $70.15 with freight and tax. */
const fundraiserRefund = (over: Record<string, unknown> = {}) => ({
  amount: 2500,
  commissionReversed: null,
  payment: {
    order: {
      id: 'order-1',
      subtotal: 60,
      discountAmount: 0,
      fundraiserCommission: 30,
      participantId: 'participant-1',
      fundraiserId: 'fundraiser-1',
    },
  },
  ...over,
})

describe('reverseFundraiserCommission', () => {
  it('takes back the merchandise share of the refund', async () => {
    const { tx, participantUpdate, fundraiserUpdate } = fakeTx({ refund: fundraiserRefund() })

    const result = await reverseFundraiserCommission(tx, 'refund-1')

    // $25 of $60 of goods is 41.67%, and 41.67% of $30 is $12.50.
    expect(result).toEqual({ reversed: true, amount: 12.5 })
    expect(Number(participantUpdate.mock.calls[0][0].data.totalCommission.decrement)).toBe(12.5)
    // Revenue comes down by the refund itself, not by the commission.
    expect(Number(fundraiserUpdate.mock.calls[0][0].data.totalRevenue.decrement)).toBe(25)
  })

  it('measures against merchandise, not the order total', async () => {
    // A full $70.15 refund is more than the $60 of goods, so the share caps at 100%.
    const { tx } = fakeTx({ refund: fundraiserRefund({ amount: 7015 }) })

    const result = await reverseFundraiserCommission(tx, 'refund-1')

    expect(result.amount).toBe(30)
  })

  it('never reverses more than is left', async () => {
    // $12.50 already taken back, so only $17.50 remains against a full refund.
    const { tx } = fakeTx({
      refund: fundraiserRefund({
        amount: 4515,
        payment: { order: { ...fundraiserRefund().payment.order, fundraiserCommission: 17.5 } },
      }),
      priorReversals: 12.5,
    })

    const result = await reverseFundraiserCommission(tx, 'refund-1')

    // The proportion is taken against the original $30, then capped at the $17.50 remaining —
    // which is what makes two partial reversals sum to exactly the credit.
    expect(result.amount).toBe(17.5)
  })

  it('leaves the order count alone, because the order still happened', async () => {
    const { tx, participantUpdate } = fakeTx({ refund: fundraiserRefund() })

    await reverseFundraiserCommission(tx, 'refund-1')

    expect(participantUpdate.mock.calls[0][0].data).not.toHaveProperty('totalOrders')
  })

  it('does nothing for a refund on an ordinary order', async () => {
    const { tx, orderUpdate } = fakeTx({
      refund: fundraiserRefund({
        payment: {
          order: {
            ...fundraiserRefund().payment.order,
            participantId: null,
            fundraiserId: null,
            fundraiserCommission: null,
          },
        },
      }),
    })

    const result = await reverseFundraiserCommission(tx, 'refund-1')

    expect(result.reason).toBe('not-a-fundraiser-order')
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('does nothing for a refund already reversed', async () => {
    const { tx, orderUpdate } = fakeTx({
      refund: fundraiserRefund({ commissionReversed: 12.5 }),
    })

    const result = await reverseFundraiserCommission(tx, 'refund-1')

    expect(result.reason).toBe('already-reversed')
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('stops when it loses the claim to a concurrent caller', async () => {
    const { tx, orderUpdate, participantUpdate } = fakeTx({
      refund: fundraiserRefund(),
      claimCount: 0,
    })

    const result = await reverseFundraiserCommission(tx, 'refund-1')

    expect(result).toEqual({ reversed: false, amount: 0, reason: 'already-reversed' })
    expect(orderUpdate).not.toHaveBeenCalled()
    expect(participantUpdate).not.toHaveBeenCalled()
  })

  it('does nothing once the order has no commission left', async () => {
    const { tx, orderUpdate } = fakeTx({
      refund: fundraiserRefund({
        payment: { order: { ...fundraiserRefund().payment.order, fundraiserCommission: 0 } },
      }),
    })

    const result = await reverseFundraiserCommission(tx, 'refund-1')

    expect(result.reason).toBe('nothing-left-to-reverse')
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('reverses against the discounted base commission was credited on', async () => {
    // $60 of goods less a $10 discount is a $50 base; $25 refunded is half of it.
    const { tx } = fakeTx({
      refund: fundraiserRefund({
        payment: {
          order: {
            ...fundraiserRefund().payment.order,
            discountAmount: 10,
            fundraiserCommission: 25,
          },
        },
      }),
    })

    const result = await reverseFundraiserCommission(tx, 'refund-1')

    expect(result.amount).toBe(12.5)
  })
})
