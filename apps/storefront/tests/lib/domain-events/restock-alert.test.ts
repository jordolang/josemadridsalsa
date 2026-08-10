import { beforeEach, describe, expect, it, vi } from 'vitest'

const restockFindFirst = vi.fn()
const createRestockNotification = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = { restockNotification: { findFirst: restockFindFirst } }
  return { prisma: client, default: client }
})

vi.mock('@/lib/inventory-manager', () => ({ createRestockNotification }))

const { handleRestockAlert, RESTOCK_COOLDOWN_DAYS } = await import(
  '@/lib/domain-events/handlers/restock-alert'
)

const NOW = new Date('2026-08-10T12:00:00Z')

function event(payload: Record<string, unknown> | null = null) {
  return {
    id: 'evt_1',
    type: 'inventory.low',
    entityType: 'product',
    entityId: 'prod_1',
    payload: payload ?? {
      alertId: 'alert_1',
      productName: 'Black Bean & Corn',
      sku: 'JMS-BBC-16',
      stockLevel: 4,
      threshold: 12,
    },
    actorUserId: null,
    createdAt: NOW,
  } as never
}

describe('restock alert handler', () => {
  beforeEach(() => {
    restockFindFirst.mockReset()
    restockFindFirst.mockResolvedValue(null)
    createRestockNotification.mockReset()
    createRestockNotification.mockResolvedValue({ success: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('mails the restock recommendation for a product that has gone low', async () => {
    await handleRestockAlert(event())

    expect(createRestockNotification).toHaveBeenCalledWith(
      'prod_1',
      'Black Bean & Corn',
      'JMS-BBC-16',
      4,
      12
    )
  })

  it('stays quiet for a product already mailed about inside the cooldown', async () => {
    // Stock sits below threshold until someone restocks, and inventory.low fires on every sale
    // that keeps it there — without this a slow mover would mail once per order.
    restockFindFirst.mockResolvedValue({ id: 'rn_1' })

    await handleRestockAlert(event())

    expect(createRestockNotification).not.toHaveBeenCalled()
  })

  it('looks back exactly the cooldown window', async () => {
    await handleRestockAlert(event())

    const cutoff = restockFindFirst.mock.calls[0][0].where.createdAt.gte as Date
    const days = Math.round((NOW.getTime() - cutoff.getTime()) / 86_400_000)
    expect(days).toBe(RESTOCK_COOLDOWN_DAYS)
  })

  it('scopes the cooldown to the product, not to restocking generally', async () => {
    await handleRestockAlert(event())

    expect(restockFindFirst.mock.calls[0][0].where.productId).toBe('prod_1')
  })

  it('skips a payload it does not recognise rather than guessing', async () => {
    // Re-reading the product could report a different stock level than the one that triggered
    // the alert, which would put a wrong number in front of whoever does the ordering.
    await handleRestockAlert(event({ alertId: 'alert_1' }))

    expect(createRestockNotification).not.toHaveBeenCalled()
  })

  it('handles an out-of-stock product, where the level is legitimately zero', async () => {
    await handleRestockAlert(
      event({
        productName: 'Chipotle',
        sku: 'JMS-CHI-16',
        stockLevel: 0,
        threshold: 12,
      })
    )

    expect(createRestockNotification).toHaveBeenCalledWith('prod_1', 'Chipotle', 'JMS-CHI-16', 0, 12)
  })
})
