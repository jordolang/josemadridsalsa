import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import type { Prisma } from '@prisma/client'

// The functions under test receive a Prisma transaction client and never touch the
// module-level `prisma` singleton — but importing the module still pulls it in, so
// stub it to keep this a pure unit test with no DB connection.
vi.mock('@/lib/prisma', () => ({ default: {} }))

import {
  deductReservedInventoryInTx,
  deductReservedInventoryOnceInTx,
} from '@/lib/inventory-manager'

/**
 * Regression test for the oversell race on the PayPal and Square checkout paths.
 *
 * A paid order is finalized by two independent paths — the checkout route and the
 * provider webhook — that each deduct the same order's reserved inventory. The
 * dangerous case is sequential replay: the webhook runs *after* the route has
 * already committed. `deductReservedInventoryInTx` is not idempotent, so a second
 * deduction silently consumes another customer's reservation, overselling stock.
 *
 * `deductReservedInventoryOnceInTx` makes the deduction idempotent per order item.
 * These tests model the race as two sequential deductions sharing committed state.
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

/**
 * A minimal in-memory Prisma transaction client that behaves transactionally enough
 * for the deduction helpers: reads see prior writes within the same shared state,
 * which is exactly what a webhook sees after the route has committed.
 */
function makeFakeTx(product: FakeProduct) {
  const products = new Map<string, FakeProduct>([[product.id, { ...product }]])
  const transactions: Array<Record<string, unknown>> = []
  let idCounter = 0

  const tx = {
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const p = products.get(where.id)
        return p ? { ...p } : null
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeProduct> }) => {
        const p = products.get(where.id)!
        Object.assign(p, data)
        return { ...p }
      },
    },
    inventoryTransaction: {
      findFirst: async ({
        where,
      }: {
        where: { productId?: string; orderId?: string; reason?: string }
      }) =>
        transactions.find(
          (t) =>
            t.productId === where.productId &&
            t.orderId === where.orderId &&
            t.reason === where.reason
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `txn-${idCounter++}`, ...data }
        transactions.push(row)
        return row
      },
    },
  }

  return {
    tx: tx as unknown as Prisma.TransactionClient,
    getProduct: () => products.get(product.id)!,
    orderCompletionCount: (orderId: string) =>
      transactions.filter((t) => t.orderId === orderId && t.reason === 'ORDER_COMPLETION').length,
  }
}

// inventory 100, of which 6 are reserved: 3 for our order and 3 for another
// customer. A double-deduction would eat the other customer's 3 reserved units.
function seedProduct(): FakeProduct {
  return {
    id: 'prod-salsa',
    name: 'Test Salsa',
    sku: 'TEST-SKU',
    inventory: 100,
    stockReserved: 6,
    lowStockThreshold: 10,
  }
}

describe('Inventory deduction idempotency (oversell race)', () => {
  it('deducts exactly once when the PayPal route and its webhook both finalize the order', async () => {
    const store = makeFakeTx(seedProduct())
    const orderId = 'order-paypal'
    const reservation = { productId: 'prod-salsa', quantity: 3, orderId }

    // Route path finalizes first.
    const first = await deductReservedInventoryOnceInTx(
      { ...reservation, notes: `PayPal payment completed for order ${orderId}` },
      store.tx
    )
    // Webhook path replays the same order.
    const second = await deductReservedInventoryOnceInTx(
      { ...reservation, notes: `Webhook deduction for order ${orderId}` },
      store.tx
    )

    expect(first).not.toBeNull()
    expect(second).toBeNull() // second deduction skipped
    expect(store.getProduct().inventory).toBe(97) // deducted once, not twice
    expect(store.getProduct().stockReserved).toBe(3) // other customer's reservation intact
    expect(store.orderCompletionCount(orderId)).toBe(1)
  })

  it('deducts exactly once when the Square route and its webhook both finalize the order', async () => {
    const store = makeFakeTx(seedProduct())
    const orderId = 'order-square'
    const reservation = { productId: 'prod-salsa', quantity: 3, orderId }

    const first = await deductReservedInventoryOnceInTx(
      { ...reservation, notes: `Square payment completed for order ${orderId}` },
      store.tx
    )
    const second = await deductReservedInventoryOnceInTx(
      { ...reservation, notes: `Webhook deduction for order ${orderId}` },
      store.tx
    )

    expect(first).not.toBeNull()
    expect(second).toBeNull()
    expect(store.getProduct().inventory).toBe(97)
    expect(store.getProduct().stockReserved).toBe(3)
    expect(store.orderCompletionCount(orderId)).toBe(1)
  })

  // Negative control: proves the fake is faithful enough to reproduce the original
  // bug, and that the guard — not some artifact of the fake — is what fixes it.
  it('the raw deduction double-deducts (oversells) when replayed — the bug this guards against', async () => {
    const store = makeFakeTx(seedProduct())
    const orderId = 'order-raw'
    const reservation = { productId: 'prod-salsa', quantity: 3, orderId }

    await deductReservedInventoryInTx(reservation, store.tx)
    await deductReservedInventoryInTx(reservation, store.tx)

    expect(store.getProduct().inventory).toBe(94) // 100 - 3 - 3: oversold
    expect(store.getProduct().stockReserved).toBe(0) // other customer's reservation consumed
    expect(store.orderCompletionCount(orderId)).toBe(2)
  })

  it('requires an orderId — a missing one would make the guard match any deduction', async () => {
    const store = makeFakeTx(seedProduct())
    await expect(
      deductReservedInventoryOnceInTx({ productId: 'prod-salsa', quantity: 1 }, store.tx)
    ).rejects.toThrow(/orderId/)
  })

  // Drift guard: the whole point of the shared helper is that no finalize path calls
  // the non-idempotent deduction directly. If a future edit reverts one, fail here.
  it('no checkout finalize path calls the non-idempotent deduction directly', () => {
    const routes = [
      '../../../../packages/core/routes/api/checkout/complete/route.ts',
      '../../../../packages/core/routes/api/checkout/paypal/capture-order/route.ts',
      '../../../../packages/core/routes/api/checkout/square/process-payment/route.ts',
      '../../app/api/webhooks/stripe/route.ts',
    ]

    for (const relPath of routes) {
      const content = readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), 'utf8')
      expect(content, `${relPath} calls deductReservedInventoryInTx directly`).not.toContain(
        'deductReservedInventoryInTx('
      )
    }
  })
})
