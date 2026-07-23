/**
 * Integration Test: Complete Checkout Reservation Flow
 *
 * This test verifies the end-to-end checkout reservation flow:
 * 1. Reserve inventory on checkout initiation
 * 2. Deduct reserved inventory on successful payment
 * 3. Release reserved inventory on payment failure
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import prisma from '@/lib/prisma'
import { reserveInventory, releaseInventory, deductReservedInventory } from '@/lib/inventory-manager'

const runIntegration = !!(process.env.DATABASE_URL || process.env.RUN_INTEGRATION_TESTS)

describe.skipIf(!runIntegration)('Checkout Reservation Flow', () => {
  let testProduct: any
  const INITIAL_INVENTORY = 50
  const RESERVE_QUANTITY_1 = 5
  const RESERVE_QUANTITY_2 = 3

  beforeAll(async () => {
    // Find or create an active category. A fresh CI database has no seed data,
    // so create one if none exists rather than failing the whole suite.
    let category = await prisma.category.findFirst({
      where: { isActive: true }
    })

    if (!category) {
      category = await prisma.category.upsert({
        where: { slug: 'test-reservation-flow-category' },
        update: {},
        create: { name: 'Test Reservation Flow Category', slug: 'test-reservation-flow-category' },
      })
    }

    // Create a test product for this test
    testProduct = await prisma.product.create({
      data: {
        name: 'Test Product - Checkout Reservation Flow',
        slug: `test-checkout-reservation-${Date.now()}`,
        sku: `TEST-CHECKOUT-${Date.now()}`,
        heatLevel: 'MILD',
        price: 10.00,
        inventory: INITIAL_INVENTORY,
        stockReserved: 0,
        stockStatus: 'IN_STOCK',
        lowStockThreshold: 10,
        categoryId: category.id,
        ingredients: ['Test ingredient'],
        isActive: true,
      },
    })
  })

  afterAll(async () => {
    // Clean up test product
    if (testProduct) {
      await prisma.inventoryTransaction.deleteMany({
        where: { productId: testProduct.id }
      })
      await prisma.product.delete({
        where: { id: testProduct.id }
      })
    }
  })

  it('should complete the full checkout reservation flow', async () => {
    // ========================================
    // STEP 1: Reserve inventory (checkout initiation)
    // ========================================
    console.log('\n[Step 1] Reserving inventory for checkout...')

    const reservation1 = await reserveInventory({
      productId: testProduct.id,
      quantity: RESERVE_QUANTITY_1,
      orderId: 'test-order-1',
      notes: 'Test checkout reservation',
    })

    expect(reservation1).toBeDefined()
    expect(reservation1.previousReserved).toBe(0)
    expect(reservation1.newReserved).toBe(RESERVE_QUANTITY_1)
    expect(reservation1.availableStock).toBe(INITIAL_INVENTORY - RESERVE_QUANTITY_1)

    // Verify database state
    let product = await prisma.product.findUnique({
      where: { id: testProduct.id },
      select: { inventory: true, stockReserved: true },
    })

    expect(product?.inventory).toBe(INITIAL_INVENTORY) // Inventory unchanged
    expect(product?.stockReserved).toBe(RESERVE_QUANTITY_1) // Reserved stock increased
    console.log(`✓ Inventory: ${product?.inventory}, Reserved: ${product?.stockReserved}`)

    // ========================================
    // STEP 2: Complete payment (deduct reserved inventory)
    // ========================================
    console.log('\n[Step 2] Completing payment (deducting reserved inventory)...')

    const deduction = await deductReservedInventory({
      productId: testProduct.id,
      quantity: RESERVE_QUANTITY_1,
      orderId: 'test-order-1',
      notes: 'Payment completed',
    })

    expect(deduction).toBeDefined()
    expect(deduction.previousInventory).toBe(INITIAL_INVENTORY)
    expect(deduction.newInventory).toBe(INITIAL_INVENTORY - RESERVE_QUANTITY_1)
    expect(deduction.previousReserved).toBe(RESERVE_QUANTITY_1)
    expect(deduction.newReserved).toBe(0)
    expect(deduction.availableStock).toBe(INITIAL_INVENTORY - RESERVE_QUANTITY_1)

    // Verify database state
    product = await prisma.product.findUnique({
      where: { id: testProduct.id },
      select: { inventory: true, stockReserved: true },
    })

    expect(product?.inventory).toBe(INITIAL_INVENTORY - RESERVE_QUANTITY_1) // Inventory decreased
    expect(product?.stockReserved).toBe(0) // Reserved stock decreased
    console.log(`✓ Inventory: ${product?.inventory}, Reserved: ${product?.stockReserved}`)

    // ========================================
    // STEP 3: Reserve inventory for second checkout
    // ========================================
    console.log('\n[Step 3] Reserving inventory for second checkout...')

    const reservation2 = await reserveInventory({
      productId: testProduct.id,
      quantity: RESERVE_QUANTITY_2,
      orderId: 'test-order-2',
      notes: 'Test checkout reservation 2',
    })

    expect(reservation2).toBeDefined()
    expect(reservation2.previousReserved).toBe(0)
    expect(reservation2.newReserved).toBe(RESERVE_QUANTITY_2)

    // Verify database state
    product = await prisma.product.findUnique({
      where: { id: testProduct.id },
      select: { inventory: true, stockReserved: true },
    })

    const expectedInventory = INITIAL_INVENTORY - RESERVE_QUANTITY_1
    expect(product?.inventory).toBe(expectedInventory) // Inventory unchanged from previous state
    expect(product?.stockReserved).toBe(RESERVE_QUANTITY_2) // Reserved stock increased
    console.log(`✓ Inventory: ${product?.inventory}, Reserved: ${product?.stockReserved}`)

    // ========================================
    // STEP 4: Cancel payment (release reserved inventory)
    // ========================================
    console.log('\n[Step 4] Canceling payment (releasing reserved inventory)...')

    const release = await releaseInventory({
      productId: testProduct.id,
      quantity: RESERVE_QUANTITY_2,
      orderId: 'test-order-2',
      notes: 'Payment canceled',
    })

    expect(release).toBeDefined()
    expect(release.previousReserved).toBe(RESERVE_QUANTITY_2)
    expect(release.newReserved).toBe(0)
    expect(release.availableStock).toBe(expectedInventory)

    // Verify final database state
    product = await prisma.product.findUnique({
      where: { id: testProduct.id },
      select: { inventory: true, stockReserved: true },
    })

    expect(product?.inventory).toBe(expectedInventory) // Inventory unchanged
    expect(product?.stockReserved).toBe(0) // Reserved stock back to 0
    console.log(`✓ Inventory: ${product?.inventory}, Reserved: ${product?.stockReserved}`)

    // ========================================
    // STEP 5: Verify transaction audit trail
    // ========================================
    console.log('\n[Step 5] Verifying transaction audit trail...')

    const transactions = await prisma.inventoryTransaction.findMany({
      where: { productId: testProduct.id },
      orderBy: { createdAt: 'asc' },
    })

    expect(transactions).toHaveLength(4)

    // Transaction 1: Reservation
    expect(transactions[0].type).toBe('RESERVATION')
    expect(transactions[0].quantity).toBe(RESERVE_QUANTITY_1)
    expect(transactions[0].orderId).toBe('test-order-1')

    // Transaction 2: Sale (deduction)
    expect(transactions[1].type).toBe('SALE')
    expect(transactions[1].quantity).toBe(-RESERVE_QUANTITY_1)
    expect(transactions[1].orderId).toBe('test-order-1')

    // Transaction 3: Reservation
    expect(transactions[2].type).toBe('RESERVATION')
    expect(transactions[2].quantity).toBe(RESERVE_QUANTITY_2)
    expect(transactions[2].orderId).toBe('test-order-2')

    // Transaction 4: Release
    expect(transactions[3].type).toBe('RELEASE')
    expect(transactions[3].quantity).toBe(-RESERVE_QUANTITY_2)
    expect(transactions[3].orderId).toBe('test-order-2')

    console.log(`✓ All 4 transactions recorded correctly`)

    console.log('\n✅ Complete checkout reservation flow verified successfully!')
  })

  it('should prevent overselling with concurrent reservations', async () => {
    console.log('\n[Concurrent Test] Testing race condition prevention...')

    // Reset product to known state
    await prisma.product.update({
      where: { id: testProduct.id },
      data: {
        inventory: 10,
        stockReserved: 0,
      },
    })

    // Try to reserve more than available stock
    const reservationPromises = [
      reserveInventory({
        productId: testProduct.id,
        quantity: 8,
        orderId: 'concurrent-order-1',
      }),
      reserveInventory({
        productId: testProduct.id,
        quantity: 8,
        orderId: 'concurrent-order-2',
      }),
    ]

    // At least one should fail due to insufficient stock
    const results = await Promise.allSettled(reservationPromises)

    const fulfilled = results.filter(r => r.status === 'fulfilled').length
    const rejected = results.filter(r => r.status === 'rejected').length

    expect(fulfilled).toBe(1) // Only one should succeed
    expect(rejected).toBe(1) // One should fail

    // Verify final state
    const product = await prisma.product.findUnique({
      where: { id: testProduct.id },
      select: { inventory: true, stockReserved: true },
    })

    expect(product?.stockReserved).toBe(8) // Only one reservation succeeded
    console.log(`✓ Race condition prevented: Reserved=${product?.stockReserved}, Available=${product ? product.inventory - product.stockReserved : 0}`)
  })
})
