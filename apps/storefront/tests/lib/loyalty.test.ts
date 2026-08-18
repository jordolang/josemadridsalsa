import { describe, expect, it, vi } from 'vitest'

import { creditPurchaseLoyaltyPoints, POINTS_PER_DOLLAR } from '@/lib/loyalty'

/**
 * A stand-in transaction client. The behaviour under test is which branch runs and whether the
 * loyalty account is touched at all, so the fake reports what was called rather than pretending
 * to be a database.
 */
function fakeTx({
  order,
  claimCount = 1,
  account = { id: 'account-1', lifetimePoints: 0, tier: 'BRONZE' },
}: {
  order: Record<string, unknown> | null
  claimCount?: number
  account?: { id: string; lifetimePoints: number; tier: string }
}) {
  const orderUpdateMany = vi.fn().mockResolvedValue({ count: claimCount })
  const accountUpsert = vi.fn().mockResolvedValue(account)
  const accountUpdate = vi.fn().mockResolvedValue({})
  const transactionCreate = vi.fn().mockResolvedValue({})

  return {
    tx: {
      order: {
        findUnique: vi.fn().mockResolvedValue(order),
        updateMany: orderUpdateMany,
      },
      loyaltyAccount: {
        upsert: accountUpsert,
        update: accountUpdate,
      },
      pointTransaction: { create: transactionCreate },
    } as unknown as Parameters<typeof creditPurchaseLoyaltyPoints>[0],
    orderUpdateMany,
    accountUpsert,
    accountUpdate,
    transactionCreate,
  }
}

// $60 of goods, $10 off → $50 spent → 500 points at 10 points/$1. Tax and freight are excluded.
const paidOrder = {
  userId: 'user-1',
  subtotal: 60,
  discountAmount: 10,
  loyaltyPointsAwardedAt: null,
}

describe('creditPurchaseLoyaltyPoints', () => {
  it('awards points once from the discounted merchandise, to the order owner’s account', async () => {
    const { tx, accountUpsert, accountUpdate, transactionCreate } = fakeTx({ order: paidOrder })

    const result = await creditPurchaseLoyaltyPoints(tx, 'order-1')

    expect(result).toEqual({ awarded: true, points: 50 * POINTS_PER_DOLLAR })

    // The account is upserted on the transaction client, keyed by the order's user.
    expect(accountUpsert).toHaveBeenCalledOnce()
    expect(accountUpsert.mock.calls[0][0].where).toEqual({ userId: 'user-1' })

    // Balance and lifetime both climb by the awarded amount.
    const updateData = accountUpdate.mock.calls[0][0].data
    expect(updateData.pointsBalance).toEqual({ increment: 500 })
    expect(updateData.lifetimePoints).toEqual({ increment: 500 })

    // Exactly one earn transaction, tied to the order.
    expect(transactionCreate).toHaveBeenCalledOnce()
    expect(transactionCreate.mock.calls[0][0].data).toMatchObject({
      accountId: 'account-1',
      type: 'EARNED_PURCHASE',
      points: 500,
      orderId: 'order-1',
    })
  })

  it('claims the marker before touching the account, guarded on a still-null column', async () => {
    const { tx, orderUpdateMany } = fakeTx({ order: paidOrder })

    await creditPurchaseLoyaltyPoints(tx, 'order-1')

    const call = orderUpdateMany.mock.calls[0][0]
    expect(call.where).toEqual({ id: 'order-1', loyaltyPointsAwardedAt: null })
    expect(call.data.loyaltyPointsAwardedAt).toBeInstanceOf(Date)
  })

  it('does not double-award when it loses the claim to a concurrent finalize', async () => {
    // Both a webhook and a completion route read a null column; only one update matches. The
    // loser must award nothing — no account upsert, no transaction, no balance change.
    const { tx, accountUpsert, accountUpdate, transactionCreate } = fakeTx({
      order: paidOrder,
      claimCount: 0,
    })

    const result = await creditPurchaseLoyaltyPoints(tx, 'order-1')

    expect(result).toEqual({ awarded: false, points: 0, reason: 'already-awarded' })
    expect(accountUpsert).not.toHaveBeenCalled()
    expect(accountUpdate).not.toHaveBeenCalled()
    expect(transactionCreate).not.toHaveBeenCalled()
  })

  it('does nothing for an order already awarded', async () => {
    const { tx, orderUpdateMany, accountUpsert } = fakeTx({
      order: { ...paidOrder, loyaltyPointsAwardedAt: new Date() },
    })

    const result = await creditPurchaseLoyaltyPoints(tx, 'order-1')

    expect(result.reason).toBe('already-awarded')
    // Bails before even attempting the claim.
    expect(orderUpdateMany).not.toHaveBeenCalled()
    expect(accountUpsert).not.toHaveBeenCalled()
  })

  it('earns nothing for a guest order and creates no account', async () => {
    const { tx, orderUpdateMany, accountUpsert } = fakeTx({
      order: { ...paidOrder, userId: null },
    })

    const result = await creditPurchaseLoyaltyPoints(tx, 'order-1')

    expect(result).toEqual({ awarded: false, points: 0, reason: 'guest-order' })
    expect(orderUpdateMany).not.toHaveBeenCalled()
    expect(accountUpsert).not.toHaveBeenCalled()
  })

  it('earns nothing on a fully discounted order without claiming the marker', async () => {
    const { tx, orderUpdateMany, accountUpsert } = fakeTx({
      order: { ...paidOrder, subtotal: 20, discountAmount: 20 },
    })

    const result = await creditPurchaseLoyaltyPoints(tx, 'order-1')

    expect(result).toEqual({ awarded: false, points: 0, reason: 'no-points' })
    expect(orderUpdateMany).not.toHaveBeenCalled()
    expect(accountUpsert).not.toHaveBeenCalled()
  })

  it('promotes the tier and stamps tierUpdatedAt when lifetime points cross a threshold', async () => {
    // Account sits at 490 lifetime points (BRONZE); a $60/no-discount order adds 600, clearing
    // the SILVER threshold (500) and the GOLD threshold (1000).
    const { tx, accountUpdate } = fakeTx({
      order: { userId: 'user-1', subtotal: 60, discountAmount: 0, loyaltyPointsAwardedAt: null },
      account: { id: 'account-1', lifetimePoints: 490, tier: 'BRONZE' },
    })

    await creditPurchaseLoyaltyPoints(tx, 'order-1')

    const updateData = accountUpdate.mock.calls[0][0].data
    expect(updateData.tier).toBe('GOLD')
    expect(updateData.tierUpdatedAt).toBeInstanceOf(Date)
  })

  it('leaves the tier untouched when the award does not cross a threshold', async () => {
    const { tx, accountUpdate } = fakeTx({
      order: { userId: 'user-1', subtotal: 5, discountAmount: 0, loyaltyPointsAwardedAt: null },
      account: { id: 'account-1', lifetimePoints: 0, tier: 'BRONZE' },
    })

    await creditPurchaseLoyaltyPoints(tx, 'order-1')

    const updateData = accountUpdate.mock.calls[0][0].data
    expect(updateData.tier).toBe('BRONZE')
    expect(updateData.tierUpdatedAt).toBeUndefined()
  })
})
