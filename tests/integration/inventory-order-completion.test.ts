import { describe, it, expect, beforeEach, vi } from 'vitest'
import { handlePaymentIntentSucceeded } from '@/lib/stripe/webhooks'
import prisma from '@/lib/prisma'
import type Stripe from 'stripe'
import { InventoryTransactionType, StockStatus } from '@prisma/client'

/**
 * Integration tests for inventory decrement on order completion
 * Verifies that when a Stripe payment succeeds:
 * 1. Order status changes to 'CONFIRMED'
 * 2. Product inventory decreases by order quantity
 * 3. Inventory transaction log is created
 * 4. Low stock alerts are triggered if applicable
 */

// Mock email sending to prevent actual emails during tests
vi.mock('@/lib/email/automation', () => ({
  sendOrderConfirmationEmail: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/inventory-alerts', () => ({
  sendLowStockAlert: vi.fn(() => Promise.resolve()),
}))

describe('Inventory Decrement on Order Completion', () => {
  let testProduct: any
  let testOrder: any

  beforeEach(async () => {
    // Clean up any existing test data
    await prisma.inventoryTransaction.deleteMany({
      where: { orderId: { startsWith: 'test-order-' } },
    })
    await prisma.orderItem.deleteMany({
      where: { orderId: { startsWith: 'test-order-' } },
    })
    await prisma.order.deleteMany({
      where: { id: { startsWith: 'test-order-' } },
    })
    await prisma.product.deleteMany({
      where: { sku: { startsWith: 'TEST-INV-' } },
    })

    // Create a test product with inventory
    testProduct = await prisma.product.create({
      data: {
        name: 'Test Product for Inventory',
        slug: `test-inventory-product-${Date.now()}`,
        sku: `TEST-INV-${Date.now()}`,
        description: 'Test product for inventory verification',
        price: 2000, // $20.00
        inventory: 100,
        stockReserved: 3, // 3 units reserved for this test order
        lowStockThreshold: 10,
        stockStatus: StockStatus.IN_STOCK,
        active: true,
        featured: false,
      },
    })

    // Create a test order with pending payment
    testOrder = await prisma.order.create({
      data: {
        id: `test-order-${Date.now()}`,
        orderNumber: `TEST-${Date.now()}`,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        phone: '555-0100',
        shippingAddress: '123 Test St',
        shippingCity: 'Test City',
        shippingState: 'CA',
        shippingZip: '90210',
        shippingCountry: 'US',
        subtotal: 6000, // 3 items x $20
        tax: 540, // 9% tax
        shipping: 500, // $5 shipping
        total: 7040,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        items: {
          create: [
            {
              productId: testProduct.id,
              name: testProduct.name,
              sku: testProduct.sku,
              quantity: 3,
              price: testProduct.price,
              subtotal: 6000,
            },
          ],
        },
      },
      include: {
        items: true,
        giftCertificates: true,
      },
    })
  })

  it('should decrement inventory when payment succeeds', async () => {
    const paymentIntent: Stripe.PaymentIntent = {
      id: 'pi_test_123',
      metadata: {
        orderId: testOrder.id,
      },
    } as Stripe.PaymentIntent

    // Process the payment intent success webhook
    const result = await handlePaymentIntentSucceeded(paymentIntent)

    expect(result.success).toBe(true)

    // Verify product inventory decreased by order quantity
    const updatedProduct = await prisma.product.findUnique({
      where: { id: testProduct.id },
    })

    expect(updatedProduct).toBeDefined()
    expect(updatedProduct!.inventory).toBe(97) // 100 - 3 = 97
    expect(updatedProduct!.stockReserved).toBe(0) // 3 - 3 = 0 (reservation released)
  })

  it('should update order status to CONFIRMED and PAID', async () => {
    const paymentIntent: Stripe.PaymentIntent = {
      id: 'pi_test_456',
      metadata: {
        orderId: testOrder.id,
      },
    } as Stripe.PaymentIntent

    await handlePaymentIntentSucceeded(paymentIntent)

    // Verify order status updated
    const updatedOrder = await prisma.order.findUnique({
      where: { id: testOrder.id },
    })

    expect(updatedOrder).toBeDefined()
    expect(updatedOrder!.status).toBe('CONFIRMED')
    expect(updatedOrder!.paymentStatus).toBe('PAID')
    expect(updatedOrder!.stripePaymentId).toBe('pi_test_456')
  })

  it('should create inventory transaction log', async () => {
    const paymentIntent: Stripe.PaymentIntent = {
      id: 'pi_test_789',
      metadata: {
        orderId: testOrder.id,
      },
    } as Stripe.PaymentIntent

    await handlePaymentIntentSucceeded(paymentIntent)

    // Verify inventory transaction was created
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        productId: testProduct.id,
        orderId: testOrder.id,
      },
    })

    expect(transactions).toHaveLength(1)
    expect(transactions[0].type).toBe(InventoryTransactionType.SALE)
    expect(transactions[0].quantity).toBe(-3) // Negative for deduction
    expect(transactions[0].previousStock).toBe(100)
    expect(transactions[0].newStock).toBe(97)
    expect(transactions[0].reason).toBe('ORDER_COMPLETION')
  })

  it('should update stock status to LOW_STOCK when inventory falls below threshold', async () => {
    // Update product to have inventory near the threshold
    await prisma.product.update({
      where: { id: testProduct.id },
      data: {
        inventory: 12, // Just above threshold of 10
        stockReserved: 3,
      },
    })

    const paymentIntent: Stripe.PaymentIntent = {
      id: 'pi_test_low_stock',
      metadata: {
        orderId: testOrder.id,
      },
    } as Stripe.PaymentIntent

    await handlePaymentIntentSucceeded(paymentIntent)

    // Verify stock status changed to LOW_STOCK
    const updatedProduct = await prisma.product.findUnique({
      where: { id: testProduct.id },
    })

    expect(updatedProduct).toBeDefined()
    expect(updatedProduct!.inventory).toBe(9) // 12 - 3 = 9 (below threshold of 10)
    expect(updatedProduct!.stockStatus).toBe(StockStatus.LOW_STOCK)
  })

  it('should update stock status to OUT_OF_STOCK when inventory reaches zero', async () => {
    // Update product to have exactly the order quantity
    await prisma.product.update({
      where: { id: testProduct.id },
      data: {
        inventory: 3,
        stockReserved: 3,
      },
    })

    const paymentIntent: Stripe.PaymentIntent = {
      id: 'pi_test_out_of_stock',
      metadata: {
        orderId: testOrder.id,
      },
    } as Stripe.PaymentIntent

    await handlePaymentIntentSucceeded(paymentIntent)

    // Verify stock status changed to OUT_OF_STOCK
    const updatedProduct = await prisma.product.findUnique({
      where: { id: testProduct.id },
    })

    expect(updatedProduct).toBeDefined()
    expect(updatedProduct!.inventory).toBe(0) // 3 - 3 = 0
    expect(updatedProduct!.stockStatus).toBe(StockStatus.OUT_OF_STOCK)
  })

  it('should handle idempotency - skip if order already paid', async () => {
    // Mark order as already paid
    await prisma.order.update({
      where: { id: testOrder.id },
      data: {
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
      },
    })

    const initialInventory = testProduct.inventory

    const paymentIntent: Stripe.PaymentIntent = {
      id: 'pi_test_idempotent',
      metadata: {
        orderId: testOrder.id,
      },
    } as Stripe.PaymentIntent

    const result = await handlePaymentIntentSucceeded(paymentIntent)

    expect(result.success).toBe(true)
    expect(result.message).toBe('Order already paid')

    // Verify inventory did not change
    const updatedProduct = await prisma.product.findUnique({
      where: { id: testProduct.id },
    })

    expect(updatedProduct!.inventory).toBe(initialInventory)
  })

  it('should handle multiple products in a single order', async () => {
    // Create a second test product
    const testProduct2 = await prisma.product.create({
      data: {
        name: 'Second Test Product',
        slug: `test-inventory-product-2-${Date.now()}`,
        sku: `TEST-INV-2-${Date.now()}`,
        description: 'Second test product',
        price: 1500,
        inventory: 50,
        stockReserved: 2,
        lowStockThreshold: 5,
        stockStatus: StockStatus.IN_STOCK,
        active: true,
        featured: false,
      },
    })

    // Create order with multiple items
    const multiItemOrder = await prisma.order.create({
      data: {
        id: `test-order-multi-${Date.now()}`,
        orderNumber: `TEST-MULTI-${Date.now()}`,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        phone: '555-0100',
        shippingAddress: '123 Test St',
        shippingCity: 'Test City',
        shippingState: 'CA',
        shippingZip: '90210',
        shippingCountry: 'US',
        subtotal: 9000,
        tax: 810,
        shipping: 500,
        total: 10310,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        items: {
          create: [
            {
              productId: testProduct.id,
              name: testProduct.name,
              sku: testProduct.sku,
              quantity: 3,
              price: testProduct.price,
              subtotal: 6000,
            },
            {
              productId: testProduct2.id,
              name: testProduct2.name,
              sku: testProduct2.sku,
              quantity: 2,
              price: testProduct2.price,
              subtotal: 3000,
            },
          ],
        },
      },
      include: {
        items: true,
        giftCertificates: true,
      },
    })

    const paymentIntent: Stripe.PaymentIntent = {
      id: 'pi_test_multi',
      metadata: {
        orderId: multiItemOrder.id,
      },
    } as Stripe.PaymentIntent

    await handlePaymentIntentSucceeded(paymentIntent)

    // Verify both products had inventory decremented
    const updatedProduct1 = await prisma.product.findUnique({
      where: { id: testProduct.id },
    })
    const updatedProduct2 = await prisma.product.findUnique({
      where: { id: testProduct2.id },
    })

    expect(updatedProduct1!.inventory).toBe(97) // 100 - 3
    expect(updatedProduct2!.inventory).toBe(48) // 50 - 2

    // Verify transaction logs created for both products
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        orderId: multiItemOrder.id,
      },
    })

    expect(transactions).toHaveLength(2)
  })
})
