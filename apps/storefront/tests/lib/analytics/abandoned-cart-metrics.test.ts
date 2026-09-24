import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The abandoned-cart dashboard's numbers.
 *
 * Two of them used to say something other than what their labels claimed, and both mattered:
 * the stage breakdown counted each cart once in its latest stage, so stage 1's total fell as
 * carts progressed, and the recovered series was keyed off the day the cart was abandoned
 * rather than the day the shopper came back and paid.
 */

const abandonedCartFindMany = vi.fn()
const emailLogFindMany = vi.fn()
const orderFindMany = vi.fn()
const orderItemGroupBy = vi.fn()
const productFindMany = vi.fn()

vi.mock('@/lib/prisma', () => {
  const client = {
    abandonedCart: { findMany: abandonedCartFindMany },
    emailLog: { findMany: emailLogFindMany },
    order: { findMany: orderFindMany },
    orderItem: { groupBy: orderItemGroupBy },
    product: { findMany: productFindMany },
  }
  return { prisma: client, default: client }
})

const { getAbandonedCartMetrics, emailStage, toDateKey } = await import(
  '@/lib/analytics/abandoned-cart-metrics'
)

const NOW = new Date('2026-08-10T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

/** A day inside the 7-day window, as a local-midnight date and its bucket key. */
function dayAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  abandonedCartFindMany.mockResolvedValue([])
  emailLogFindMany.mockResolvedValue([])
  orderFindMany.mockResolvedValue([])
  orderItemGroupBy.mockResolvedValue([])
  productFindMany.mockResolvedValue([])
})

describe('emailStage', () => {
  it('reads the stage the send path wrote', () => {
    expect(emailStage({ type: 'abandoned_cart', stage: 2 })).toBe(2)
  })

  it('accepts a stage stored as a string', () => {
    expect(emailStage({ stage: '3' })).toBe(3)
  })

  it('refuses anything that is not a stage in the sequence', () => {
    expect(emailStage(null)).toBeNull()
    expect(emailStage({})).toBeNull()
    expect(emailStage({ stage: 0 })).toBeNull()
    expect(emailStage({ stage: 4 })).toBeNull()
    expect(emailStage({ stage: 'first' })).toBeNull()
    expect(emailStage({ stage: 1.5 })).toBeNull()
  })
})

describe('getAbandonedCartMetrics', () => {
  it('counts every send at its own stage, not the cart at its latest one', async () => {
    // One cart that has had all three emails. The old shape reported it only under stage 3.
    emailLogFindMany.mockResolvedValue([
      { metadata: { type: 'abandoned_cart', stage: 1, cartId: 'cart_1' }, openedAt: new Date(), clickedAt: null },
      { metadata: { type: 'abandoned_cart', stage: 2, cartId: 'cart_1' }, openedAt: null, clickedAt: null },
      { metadata: { type: 'abandoned_cart', stage: 3, cartId: 'cart_1' }, openedAt: new Date(), clickedAt: new Date() },
    ])

    const metrics = await getAbandonedCartMetrics('7d')

    expect(metrics.emailsByStage.map((stage) => stage.sent)).toEqual([1, 1, 1])
    expect(metrics.summary.emailsSent).toBe(3)
  })

  it('reports opens and clicks per stage', async () => {
    emailLogFindMany.mockResolvedValue([
      { metadata: { stage: 1 }, openedAt: new Date(), clickedAt: new Date() },
      { metadata: { stage: 1 }, openedAt: new Date(), clickedAt: null },
      { metadata: { stage: 1 }, openedAt: null, clickedAt: null },
    ])

    const [stageOne] = await getAbandonedCartMetrics('7d').then((m) => m.emailsByStage)

    expect(stageOne).toMatchObject({ stage: 1, sent: 3, opened: 2, clicked: 1 })
  })

  it('keeps a row for a stage nothing has been sent at', async () => {
    const metrics = await getAbandonedCartMetrics('7d')

    expect(metrics.emailsByStage).toHaveLength(3)
    expect(metrics.emailsByStage.every((stage) => stage.sent === 0)).toBe(true)
  })

  it('ignores a log row whose stage it cannot read', async () => {
    emailLogFindMany.mockResolvedValue([
      { metadata: { stage: 9 }, openedAt: null, clickedAt: null },
      { metadata: null, openedAt: null, clickedAt: null },
    ])

    const metrics = await getAbandonedCartMetrics('7d')

    expect(metrics.summary.emailsSent).toBe(0)
  })

  it('plots a recovery on the day the order was placed, not the day the cart was left', async () => {
    const abandoned = dayAgo(5)
    const bought = dayAgo(1)

    abandonedCartFindMany.mockResolvedValue([{ id: 'cart_1', createdAt: abandoned }])
    orderFindMany.mockResolvedValue([
      { id: 'order_1', total: 40, createdAt: bought, abandonedCartId: 'cart_1' },
    ])

    const { chart } = await getAbandonedCartMetrics('7d')

    expect(chart.find((point) => point.date === toDateKey(abandoned))).toMatchObject({
      abandoned: 1,
      recovered: 0,
    })
    expect(chart.find((point) => point.date === toDateKey(bought))).toMatchObject({
      abandoned: 0,
      recovered: 1,
    })
  })

  it('plots a cart abandoned before the range but recovered inside it', async () => {
    const bought = dayAgo(2)

    // No matching abandonedCart row: the cart was created outside the window.
    orderFindMany.mockResolvedValue([
      { id: 'order_1', total: 25, createdAt: bought, abandonedCartId: 'cart_old' },
    ])

    const { chart, summary } = await getAbandonedCartMetrics('7d')

    expect(chart.find((point) => point.date === toDateKey(bought))?.recovered).toBe(1)
    expect(summary.totalRecovered).toBe(1)
  })

  it('counts a cart once however many orders are attributed to it', async () => {
    const bought = dayAgo(3)

    orderFindMany.mockResolvedValue([
      { id: 'order_1', total: 10, createdAt: bought, abandonedCartId: 'cart_1' },
      { id: 'order_2', total: 10, createdAt: bought, abandonedCartId: 'cart_1' },
    ])

    const { chart, summary } = await getAbandonedCartMetrics('7d')

    expect(chart.find((point) => point.date === toDateKey(bought))?.recovered).toBe(1)
    expect(summary.totalRecovered).toBe(1)
    // Revenue is still both orders — it is the money, not the carts.
    expect(summary.attributedRevenue).toBe(20)
  })
})
