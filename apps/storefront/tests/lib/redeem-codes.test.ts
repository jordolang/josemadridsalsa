import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redeemOrderCodesInTx } from '@/lib/orders/redeem-codes'

const ORDER_ID = 'clorderaaaaaaaaaaaaaaaaaa'

function buildTx(overrides: Record<string, unknown> = {}) {
  return {
    discountCode: {
      findUnique: vi.fn().mockResolvedValue({ id: 'disc1', code: 'WELCOME15' }),
      update: vi.fn().mockResolvedValue({}),
    },
    discountUsage: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    giftCertificate: {
      findUnique: vi.fn().mockResolvedValue({ id: 'gc1', code: 'GIFT50', balance: 50 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    giftCertificateUsage: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as never
}

const baseParams = {
  orderId: ORDER_ID,
  userId: null,
  discountCode: null,
  discountAmount: 0,
  giftCertificateCode: null,
  giftCertificateAmount: 0,
  orderTotal: 20,
}

describe('redeemOrderCodesInTx', () => {
  beforeEach(() => vi.clearAllMocks())

  it('records discount usage and increments the code usage count', async () => {
    const tx = buildTx()

    await redeemOrderCodesInTx(tx, {
      ...baseParams,
      discountCode: 'WELCOME15',
      discountAmount: 3,
    })

    expect((tx as any).discountUsage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ discountCodeId: 'disc1', orderId: ORDER_ID, discountAmount: 3 }),
      })
    )
    expect((tx as any).discountCode.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { usedCount: { increment: 1 } } })
    )
  })

  it('does not double-count a discount when both completion paths run for one order', async () => {
    // The Stripe webhook already recorded this usage.
    const tx = buildTx({
      discountUsage: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existing' }),
        create: vi.fn(),
      },
    })

    await redeemOrderCodesInTx(tx, {
      ...baseParams,
      discountCode: 'WELCOME15',
      discountAmount: 3,
    })

    expect((tx as any).discountUsage.create).not.toHaveBeenCalled()
    expect((tx as any).discountCode.update).not.toHaveBeenCalled()
  })

  it('decrements the gift certificate balance and records the usage', async () => {
    const tx = buildTx()

    await redeemOrderCodesInTx(tx, {
      ...baseParams,
      giftCertificateCode: 'GIFT50',
      giftCertificateAmount: 20,
    })

    expect((tx as any).giftCertificate.updateMany).toHaveBeenCalledWith({
      where: { id: 'gc1', balance: { gte: 20 } },
      data: { balance: { decrement: 20 } },
    })
    expect((tx as any).giftCertificateUsage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: ORDER_ID, amount: 20, balanceAfter: 30 }),
      })
    )
  })

  it('does not decrement the gift balance twice for one order', async () => {
    const tx = buildTx({
      giftCertificateUsage: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existing' }),
        create: vi.fn(),
      },
    })

    await redeemOrderCodesInTx(tx, {
      ...baseParams,
      giftCertificateCode: 'GIFT50',
      giftCertificateAmount: 20,
    })

    expect((tx as any).giftCertificate.updateMany).not.toHaveBeenCalled()
    expect((tx as any).giftCertificateUsage.create).not.toHaveBeenCalled()
  })

  it('marks the certificate REDEEMED once the balance reaches zero', async () => {
    const tx = buildTx()

    await redeemOrderCodesInTx(tx, {
      ...baseParams,
      giftCertificateCode: 'GIFT50',
      giftCertificateAmount: 50,
    })

    expect((tx as any).giftCertificate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REDEEMED' }) })
    )
  })

  it('throws rather than completing the order if the gift balance no longer covers it', async () => {
    // Another order spent the balance first. The customer was already charged a total
    // reduced by this certificate, so completing would hand over goods that were not paid for.
    const tx = buildTx({
      giftCertificate: {
        findUnique: vi.fn().mockResolvedValue({ id: 'gc1', code: 'GIFT50', balance: 5 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn(),
      },
    })

    await expect(
      redeemOrderCodesInTx(tx, {
        ...baseParams,
        giftCertificateCode: 'GIFT50',
        giftCertificateAmount: 20,
      })
    ).rejects.toThrow(/Failed to redeem gift certificate/)
  })

  it('does nothing when no codes were applied', async () => {
    const tx = buildTx()

    await redeemOrderCodesInTx(tx, baseParams)

    expect((tx as any).discountUsage.create).not.toHaveBeenCalled()
    expect((tx as any).giftCertificate.updateMany).not.toHaveBeenCalled()
  })
})
