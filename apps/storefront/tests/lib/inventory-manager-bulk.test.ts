import { describe, it, expect, vi } from 'vitest'
import type { Prisma } from '@prisma/client'

// The function under test receives a Prisma transaction client and never touches the
// module-level `prisma` singleton — but importing the module still pulls it in, so
// stub it to keep this a pure unit test with no DB connection.
vi.mock('@/lib/prisma', () => ({ default: {} }))

import { bulkDeductReservedInventoryOnceInTx } from '@/lib/inventory-manager'

/**
 * Unit tests for `bulkDeductReservedInventoryOnceInTx`.
 *
 * This function batches idempotent inventory deductions for multiple order items,
 * avoiding N+1 queries by checking existing deductions in a single query.
 * These tests verify the batching behavior, idempotency, and error handling.
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
 * for the bulk deduction helper: tracks products and inventory transactions.
 */
function makeFakeTx(products: FakeProduct[]) {
  const productMap = new Map<string, FakeProduct>(products.map(p => [p.id, { ...p }]))
  const transactions: Array<Record<string, unknown>> = []
  let idCounter = 0
  let findManyCallCount = 0

  const tx = {
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const p = productMap.get(where.id)
        return p ? { ...p } : null
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeProduct> }) => {
        const p = productMap.get(where.id)!
        Object.assign(p, data)
        return { ...p }
      },
    },
    inventoryTransaction: {
      findMany: async ({
        where,
      }: {
        where: { OR?: Array<{ productId?: string; orderId?: string; reason?: string }> }
      }) => {
        findManyCallCount++
        if (!where.OR) return []

        // Return transactions that match any of the OR conditions
        return transactions.filter(t =>
          where.OR!.some(
            condition =>
              t.productId === condition.productId &&
              t.orderId === condition.orderId &&
              t.reason === condition.reason
          )
        )
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `txn-${idCounter++}`, ...data }
        transactions.push(row)
        return row
      },
    },
  }

  return {
    tx: tx as unknown as Prisma.TransactionClient,
    getProduct: (id: string) => productMap.get(id)!,
    getFindManyCallCount: () => findManyCallCount,
    orderCompletionCount: (orderId: string) =>
      transactions.filter((t) => t.orderId === orderId && t.reason === 'ORDER_COMPLETION').length,
  }
}

// Seed products: three products with varying stock levels
function seedProducts(): FakeProduct[] {
  return [
    {
      id: 'prod-mild',
      name: 'Mild Salsa',
      sku: 'SALSA-MILD',
      inventory: 100,
      stockReserved: 10, // 5 for our order, 5 for others
      lowStockThreshold: 10,
    },
    {
      id: 'prod-hot',
      name: 'Hot Salsa',
      sku: 'SALSA-HOT',
      inventory: 50,
      stockReserved: 8, // 3 for our order, 5 for others
      lowStockThreshold: 10,
    },
    {
      id: 'prod-ghost',
      name: 'Ghost Pepper Salsa',
      sku: 'SALSA-GHOST',
      inventory: 25,
      stockReserved: 7, // 2 for our order, 5 for others
      lowStockThreshold: 5,
    },
  ]
}

describe('bulkDeductReservedInventoryOnceInTx', () => {
  it('deducts multiple items in a single batch check (avoids N+1)', async () => {
    const store = makeFakeTx(seedProducts())
    const orderId = 'order-bulk-1'

    const reservations = [
      { productId: 'prod-mild', quantity: 5, orderId },
      { productId: 'prod-hot', quantity: 3, orderId },
      { productId: 'prod-ghost', quantity: 2, orderId },
    ]

    const results = await bulkDeductReservedInventoryOnceInTx(reservations, store.tx)

    // All three deductions should succeed
    expect(results).toHaveLength(3)
    expect(results[0]).not.toBeNull()
    expect(results[1]).not.toBeNull()
    expect(results[2]).not.toBeNull()

    // Verify inventory was deducted correctly
    expect(store.getProduct('prod-mild').inventory).toBe(95) // 100 - 5
    expect(store.getProduct('prod-mild').stockReserved).toBe(5) // 10 - 5
    expect(store.getProduct('prod-hot').inventory).toBe(47) // 50 - 3
    expect(store.getProduct('prod-hot').stockReserved).toBe(5) // 8 - 3
    expect(store.getProduct('prod-ghost').inventory).toBe(23) // 25 - 2
    expect(store.getProduct('prod-ghost').stockReserved).toBe(5) // 7 - 2

    // Critical: should use only ONE batched findMany call, not N
    expect(store.getFindManyCallCount()).toBe(1)

    // Three ORDER_COMPLETION transactions should be created
    expect(store.orderCompletionCount(orderId)).toBe(3)
  })

  it('skips items already deducted (idempotency)', async () => {
    const store = makeFakeTx(seedProducts())
    const orderId = 'order-idempotent'

    const reservations = [
      { productId: 'prod-mild', quantity: 5, orderId },
      { productId: 'prod-hot', quantity: 3, orderId },
      { productId: 'prod-ghost', quantity: 2, orderId },
    ]

    // First deduction: all succeed
    const firstResults = await bulkDeductReservedInventoryOnceInTx(reservations, store.tx)
    expect(firstResults[0]).not.toBeNull()
    expect(firstResults[1]).not.toBeNull()
    expect(firstResults[2]).not.toBeNull()

    // Second deduction: all should be skipped
    const secondResults = await bulkDeductReservedInventoryOnceInTx(reservations, store.tx)
    expect(secondResults[0]).toBeNull()
    expect(secondResults[1]).toBeNull()
    expect(secondResults[2]).toBeNull()

    // Inventory should not change on second deduction
    expect(store.getProduct('prod-mild').inventory).toBe(95)
    expect(store.getProduct('prod-hot').inventory).toBe(47)
    expect(store.getProduct('prod-ghost').inventory).toBe(23)

    // Still only three transactions (not six)
    expect(store.orderCompletionCount(orderId)).toBe(3)
  })

  it('handles partial replay (some items already deducted)', async () => {
    const store = makeFakeTx(seedProducts())
    const orderId = 'order-partial'

    // First, deduct only the first and third items
    const firstBatch = [
      { productId: 'prod-mild', quantity: 5, orderId },
      { productId: 'prod-ghost', quantity: 2, orderId },
    ]
    await bulkDeductReservedInventoryOnceInTx(firstBatch, store.tx)

    // Now try to deduct all three items
    const fullBatch = [
      { productId: 'prod-mild', quantity: 5, orderId },
      { productId: 'prod-hot', quantity: 3, orderId },
      { productId: 'prod-ghost', quantity: 2, orderId },
    ]
    const results = await bulkDeductReservedInventoryOnceInTx(fullBatch, store.tx)

    // First and third should be skipped, second should succeed
    expect(results[0]).toBeNull() // Already deducted
    expect(results[1]).not.toBeNull() // New deduction
    expect(results[2]).toBeNull() // Already deducted

    // Verify inventory state
    expect(store.getProduct('prod-mild').inventory).toBe(95)
    expect(store.getProduct('prod-hot').inventory).toBe(47)
    expect(store.getProduct('prod-ghost').inventory).toBe(23)

    // Three total transactions (2 from first batch, 1 from second)
    expect(store.orderCompletionCount(orderId)).toBe(3)
  })

  it('throws if any reservation is missing orderId', async () => {
    const store = makeFakeTx(seedProducts())

    const reservationsWithoutOrderId = [
      { productId: 'prod-mild', quantity: 5, orderId: 'order-123' },
      { productId: 'prod-hot', quantity: 3 }, // Missing orderId
      { productId: 'prod-ghost', quantity: 2, orderId: 'order-123' },
    ]

    await expect(
      bulkDeductReservedInventoryOnceInTx(reservationsWithoutOrderId as any, store.tx)
    ).rejects.toThrow(/orderId/)

    // No deductions should have occurred
    expect(store.getProduct('prod-mild').inventory).toBe(100)
    expect(store.getProduct('prod-hot').inventory).toBe(50)
    expect(store.getProduct('prod-ghost').inventory).toBe(25)
  })

  it('validates all orderIds before making any database calls', async () => {
    const store = makeFakeTx(seedProducts())

    const invalidReservations = [
      { productId: 'prod-mild', quantity: 5 }, // Missing orderId
    ]

    await expect(
      bulkDeductReservedInventoryOnceInTx(invalidReservations as any, store.tx)
    ).rejects.toThrow(/orderId/)

    // Should fail before making any DB calls
    expect(store.getFindManyCallCount()).toBe(0)
  })

  it('preserves input order in results array', async () => {
    const store = makeFakeTx(seedProducts())
    const orderId = 'order-ordered'

    const reservations = [
      { productId: 'prod-ghost', quantity: 2, orderId }, // Third product first
      { productId: 'prod-mild', quantity: 5, orderId }, // First product second
      { productId: 'prod-hot', quantity: 3, orderId }, // Second product third
    ]

    const results = await bulkDeductReservedInventoryOnceInTx(reservations, store.tx)

    // Results should be in same order as input
    expect(results).toHaveLength(3)
    expect(results[0]).not.toBeNull()
    expect(results[1]).not.toBeNull()
    expect(results[2]).not.toBeNull()

    // Verify each result corresponds to correct product (check SKU in product field)
    expect(results[0]!.product.id).toBe('prod-ghost')
    expect(results[1]!.product.id).toBe('prod-mild')
    expect(results[2]!.product.id).toBe('prod-hot')
  })

  it('handles empty reservations array', async () => {
    const store = makeFakeTx(seedProducts())

    const results = await bulkDeductReservedInventoryOnceInTx([], store.tx)

    expect(results).toHaveLength(0)
    expect(store.getFindManyCallCount()).toBe(1) // Still makes the batch check
  })

  it('handles single reservation (degenerates to single-item case)', async () => {
    const store = makeFakeTx(seedProducts())
    const orderId = 'order-single'

    const reservations = [{ productId: 'prod-mild', quantity: 5, orderId }]

    const results = await bulkDeductReservedInventoryOnceInTx(reservations, store.tx)

    expect(results).toHaveLength(1)
    expect(results[0]).not.toBeNull()
    expect(store.getProduct('prod-mild').inventory).toBe(95)
    expect(store.getFindManyCallCount()).toBe(1)
  })

  it('different orders do not interfere with each other', async () => {
    const store = makeFakeTx(seedProducts())

    // First order deducts
    const order1Reservations = [{ productId: 'prod-mild', quantity: 5, orderId: 'order-1' }]
    const results1 = await bulkDeductReservedInventoryOnceInTx(order1Reservations, store.tx)
    expect(results1[0]).not.toBeNull()

    // Second order for same product should NOT be skipped
    const order2Reservations = [{ productId: 'prod-mild', quantity: 3, orderId: 'order-2' }]
    const results2 = await bulkDeductReservedInventoryOnceInTx(order2Reservations, store.tx)
    expect(results2[0]).not.toBeNull()

    // Both deductions should have occurred
    expect(store.getProduct('prod-mild').inventory).toBe(92) // 100 - 5 - 3
    expect(store.orderCompletionCount('order-1')).toBe(1)
    expect(store.orderCompletionCount('order-2')).toBe(1)
  })

  it('returns detailed deduction results with inventory snapshots', async () => {
    const store = makeFakeTx(seedProducts())
    const orderId = 'order-detailed'

    const reservations = [{ productId: 'prod-mild', quantity: 5, orderId }]

    const results = await bulkDeductReservedInventoryOnceInTx(reservations, store.tx)

    const result = results[0]!
    expect(result).toMatchObject({
      previousInventory: 100,
      newInventory: 95,
      previousReserved: 10,
      newReserved: 5,
      availableStock: 90, // 95 inventory - 5 reserved
    })

    expect(result.product).toBeDefined()
    expect(result.product.id).toBe('prod-mild')
    expect(result.transaction).toBeDefined()
    expect(result.transaction.reason).toBe('ORDER_COMPLETION')
  })

  it('propagates validation errors from underlying deduction (insufficient inventory)', async () => {
    const store = makeFakeTx([
      {
        id: 'prod-low',
        name: 'Low Stock Salsa',
        sku: 'SALSA-LOW',
        inventory: 2, // Only 2 in stock
        stockReserved: 10, // Enough reserved but not enough inventory
        lowStockThreshold: 5,
      },
    ])

    const reservations = [
      { productId: 'prod-low', quantity: 5, orderId: 'order-fail' }, // Try to deduct 5 but only 2 in inventory
    ]

    await expect(
      bulkDeductReservedInventoryOnceInTx(reservations, store.tx)
    ).rejects.toThrow(/Insufficient inventory/)
  })

  it('propagates validation errors from underlying deduction (insufficient reserved)', async () => {
    const store = makeFakeTx([
      {
        id: 'prod-reserved',
        name: 'Reserved Salsa',
        sku: 'SALSA-RESERVED',
        inventory: 100,
        stockReserved: 2, // Only 2 reserved
        lowStockThreshold: 5,
      },
    ])

    const reservations = [
      { productId: 'prod-reserved', quantity: 5, orderId: 'order-fail' }, // Try to deduct 5 but only 2 reserved
    ]

    await expect(
      bulkDeductReservedInventoryOnceInTx(reservations, store.tx)
    ).rejects.toThrow(/Cannot deduct more than reserved/)
  })

  it('uses consistent batch query format for existing deductions check', async () => {
    const store = makeFakeTx(seedProducts())
    const orderId = 'order-batch-check'

    // Spy on findMany to verify the query structure
    const findManySpy = vi.spyOn(store.tx.inventoryTransaction, 'findMany')

    const reservations = [
      { productId: 'prod-mild', quantity: 5, orderId },
      { productId: 'prod-hot', quantity: 3, orderId },
    ]

    await bulkDeductReservedInventoryOnceInTx(reservations, store.tx)

    // Verify findMany was called exactly once
    expect(findManySpy).toHaveBeenCalledTimes(1)

    // Verify the query structure uses OR for batching
    const call = findManySpy.mock.calls[0][0]
    expect(call.where.OR).toHaveLength(2)
    expect(call.where.OR[0]).toMatchObject({
      productId: 'prod-mild',
      orderId,
      reason: 'ORDER_COMPLETION',
    })
    expect(call.where.OR[1]).toMatchObject({
      productId: 'prod-hot',
      orderId,
      reason: 'ORDER_COMPLETION',
    })
  })
})
