import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import type { Prisma } from '@prisma/client'

const deductOnce = vi.fn()
const checkAlerts = vi.fn()
const notifyOperators = vi.fn()

vi.mock('@/lib/inventory-manager', () => ({
  deductReservedInventoryOnceInTx: (...a: unknown[]) => deductOnce(...a),
  checkAndUpdateAlerts: (...a: unknown[]) => checkAlerts(...a),
}))
vi.mock('@/lib/notifications/dispatch', () => ({
  notifyOperators: (...a: unknown[]) => notifyOperators(...a),
  severityFor: () => 'WARNING',
}))

const { deductWebhookOrderStockInTx, settleWebhookStock } = await import('@/lib/payments/webhook-stock')

const tx = {} as Prisma.TransactionClient
const order = {
  id: 'order-1',
  orderNumber: 'JMS-1001',
  items: [
    { productId: 'mild', quantity: 2 },
    { productId: 'hot', quantity: 1 },
    { productId: 'verde', quantity: 3 },
  ],
}

describe('webhook stock deduction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkAlerts.mockResolvedValue(undefined)
  })

  it('deducts each item through the once-per-order guard, skipping items already deducted', async () => {
    deductOnce
      .mockResolvedValueOnce({ product: { id: 'mild', lowStockThreshold: 5 }, newInventory: 8 })
      .mockResolvedValueOnce(null) // the capture route already deducted this one
      .mockResolvedValueOnce({ product: { id: 'verde', lowStockThreshold: 5 }, newInventory: 2 })

    const result = await deductWebhookOrderStockInTx(tx, order, 'PayPal')

    expect(deductOnce).toHaveBeenCalledTimes(3)
    expect(deductOnce.mock.calls[0][0]).toMatchObject({ productId: 'mild', quantity: 2, orderId: 'order-1' })
    expect(result.deducted.map((d) => d.productId)).toEqual(['mild', 'verde'])
    expect(result.failed).toEqual([])
  })

  it('records a released reservation instead of throwing, so the order still gets marked paid', async () => {
    deductOnce
      .mockRejectedValueOnce(new Error('Cannot deduct more than reserved for Mild'))
      .mockResolvedValue({ product: { id: 'x', lowStockThreshold: 1 }, newInventory: 9 })

    const result = await deductWebhookOrderStockInTx(tx, order, 'Square')

    expect(result.failed).toEqual([{ productId: 'mild', quantity: 2, reason: 'Cannot deduct more than reserved for Mild' }])
    expect(result.deducted).toHaveLength(2)
  })

  it('alerts staff only when an item could not be deducted', async () => {
    await settleWebhookStock(order, 'PayPal', {
      deducted: [{ productId: 'mild', newInventory: 8, lowStockThreshold: 5 }],
      failed: [],
    })
    expect(checkAlerts).toHaveBeenCalledWith('mild', 8, 5)
    expect(notifyOperators).not.toHaveBeenCalled()

    await settleWebhookStock(order, 'PayPal', {
      deducted: [],
      failed: [{ productId: 'hot', quantity: 1, reason: 'released' }],
    })
    expect(notifyOperators).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'order-1', dedupeKey: 'webhook-stock:order-1' }),
    )
  })

  it.each(['paypal', 'square'])('is wired into the %s webhook inside a Serializable transaction', (name) => {
    const source = readFileSync(`app/api/webhooks/${name}/route.ts`, 'utf8')
    const call = source.indexOf('deductWebhookOrderStockInTx(tx, order')
    expect(call).toBeGreaterThan(-1)
    expect(source.indexOf("isolationLevel: 'Serializable'", call)).toBeGreaterThan(call)
    expect(source).toContain('settleWebhookStock(order')
  })
})
