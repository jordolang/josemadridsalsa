import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Regression tests for the abandoned-checkout inventory leak.
 *
 * Checkout reserves stock before it asks for money, and the last step of a card payment
 * happens in the browser. When `confirmCardPayment` errors — or the customer closes the tab —
 * `/api/checkout/complete` is never called and the server is never told, so the order sat
 * PENDING with its stock reserved forever.
 *
 * The fix is a sweep that releases those reservations, which introduces the opposite danger:
 * more than one path can now decide the same order will never be paid. Releasing twice
 * under-counts `Product.stockReserved` and oversells the product. `releaseOrderReservation`
 * claims the order first, so exactly one caller does the work.
 *
 * These run against an in-memory Prisma stand-in rather than a spy, so the real
 * `releaseInventory` arithmetic is what moves the numbers below.
 */

interface FakeProduct {
  id: string
  name: string
  sku: string
  inventory: number
  stockReserved: number
  lowStockThreshold: number
  stockStatus?: string
}

interface FakeOrder {
  id: string
  userId: string | null
  inventoryReleasedAt: Date | null
  items: Array<{ productId: string; quantity: number }>
}

const state: { products: Map<string, FakeProduct>; orders: Map<string, FakeOrder> } = {
  products: new Map(),
  orders: new Map(),
}

const productStore = {
  findUnique: async ({ where }: { where: { id: string } }) => {
    const p = state.products.get(where.id)
    return p ? { ...p } : null
  },
  update: async ({ where, data }: { where: { id: string }; data: Partial<FakeProduct> }) => {
    const p = state.products.get(where.id)!
    Object.assign(p, data)
    return { ...p }
  },
}

const prismaFake = {
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      product: productStore,
      inventoryTransaction: { create: async ({ data }: { data: unknown }) => data },
    }),
  product: productStore,
  inventoryTransaction: { create: async ({ data }: { data: unknown }) => data },
  order: {
    // Mirrors the conditional update the helper relies on: it only matches while
    // inventoryReleasedAt is still null, and reports how many rows it actually claimed.
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; inventoryReleasedAt: null }
      data: { inventoryReleasedAt: Date }
    }) => {
      const order = state.orders.get(where.id)
      if (!order || order.inventoryReleasedAt !== null) return { count: 0 }
      order.inventoryReleasedAt = data.inventoryReleasedAt
      return { count: 1 }
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const order = state.orders.get(where.id)
      return order ? { userId: order.userId, items: order.items } : null
    },
  },
}

vi.mock('@/lib/prisma', () => ({ default: prismaFake, prisma: prismaFake }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/inventory-alerts', () => ({ sendLowStockAlert: vi.fn() }))
vi.mock('@/lib/domain-events/emit', () => ({ emitDomainEvent: vi.fn() }))
vi.mock('@/lib/notifications/dispatch', () => ({ notifyOperators: vi.fn(), dedupeKeys: {} }))
vi.mock('@/lib/inventory/alert-notifications', () => ({ inventoryAlertSpec: vi.fn() }))

const { releaseOrderReservation } = await import('@/lib/inventory-manager')

function seed() {
  state.products = new Map<string, FakeProduct>([
    ['prod-a', { id: 'prod-a', name: 'Mild', sku: 'MILD', inventory: 10, stockReserved: 3, lowStockThreshold: 2 }],
    ['prod-b', { id: 'prod-b', name: 'Hot', sku: 'HOT', inventory: 10, stockReserved: 1, lowStockThreshold: 2 }],
  ])
  state.orders = new Map<string, FakeOrder>([
    [
      'order-1',
      {
        id: 'order-1',
        userId: 'user-1',
        inventoryReleasedAt: null,
        items: [
          { productId: 'prod-a', quantity: 2 },
          { productId: 'prod-b', quantity: 1 },
        ],
      },
    ],
  ])
}

beforeEach(() => {
  seed()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('releaseOrderReservation', () => {
  it('gives the reserved stock back and stamps the order', async () => {
    const result = await releaseOrderReservation('order-1', 'abandoned checkout')

    expect(result).toEqual({ released: true, itemsReleased: 2, failures: 0 })
    expect(state.products.get('prod-a')!.stockReserved).toBe(1)
    expect(state.products.get('prod-b')!.stockReserved).toBe(0)
    expect(state.orders.get('order-1')!.inventoryReleasedAt).toBeInstanceOf(Date)
  })

  it('leaves actual inventory alone — a reservation is a hold, not a sale', async () => {
    await releaseOrderReservation('order-1', 'abandoned checkout')

    expect(state.products.get('prod-a')!.inventory).toBe(10)
    expect(state.products.get('prod-b')!.inventory).toBe(10)
  })

  it('does not release twice when two paths race for the same order', async () => {
    const first = await releaseOrderReservation('order-1', 'payment failed')
    const second = await releaseOrderReservation('order-1', 'expiry sweep')

    expect(first.released).toBe(true)
    expect(second).toEqual({ released: false, itemsReleased: 0, failures: 0 })

    // The decisive assertion: a second release would take these to -1 and 0-1, overselling.
    expect(state.products.get('prod-a')!.stockReserved).toBe(1)
    expect(state.products.get('prod-b')!.stockReserved).toBe(0)
  })

  it('survives concurrent callers, not just sequential ones', async () => {
    const [a, b] = await Promise.all([
      releaseOrderReservation('order-1', 'payment failed'),
      releaseOrderReservation('order-1', 'expiry sweep'),
    ])

    expect([a.released, b.released].filter(Boolean)).toHaveLength(1)
    expect(state.products.get('prod-a')!.stockReserved).toBe(1)
  })

  it('reports per-item failures without abandoning the remaining items', async () => {
    // A product that no longer exists makes releaseInventory throw for that item only.
    state.orders.get('order-1')!.items.push({ productId: 'prod-missing', quantity: 1 })

    const result = await releaseOrderReservation('order-1', 'abandoned checkout')

    expect(result.released).toBe(true)
    expect(result.failures).toBe(1)
    expect(result.itemsReleased).toBe(2)
    expect(state.products.get('prod-a')!.stockReserved).toBe(1)
  })

  it('treats a missing order as claimed rather than retrying it forever', async () => {
    const result = await releaseOrderReservation('order-gone', 'expiry sweep')

    expect(result).toEqual({ released: false, itemsReleased: 0, failures: 0 })
  })
})
