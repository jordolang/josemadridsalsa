/**
 * Integration Test: Inventory Alerts System
 *
 * This test verifies the end-to-end inventory alerts functionality:
 * 1. Send low stock alert for a single product
 * 2. Send batch alerts for multiple products
 * 3. Send consolidated low stock alerts
 * 4. Check and notify low stock products
 * 5. Verify alert records and notification tracking
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import prisma from '@/lib/prisma'
import { UserRole, InventoryAlertType, InventoryAlertStatus } from '@prisma/client'
import {
  sendLowStockAlert,
  sendBatchLowStockAlerts,
  sendConsolidatedLowStockAlert,
  checkAndNotifyLowStock,
} from '@/lib/inventory-alerts'

// These tests create, mutate and delete rows, so they need a database they own.
// DATABASE_URL cannot signal that: @prisma/client loads apps/storefront/.env
// itself, so it is set on every developer machine and used to point this suite
// at shared dev — where the assertions below fail against real data and the
// writes land on rows someone else cares about. CI opts in explicitly.
const runIntegration = !!process.env.RUN_INTEGRATION_TESTS

// Mock email sending
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'test-message-id' }),
}))

// Mock react-email render
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockReturnValue('<html>Test Email</html>'),
}))

import { sendEmail } from '@/lib/email'

describe.skipIf(!runIntegration)('Inventory Alerts System', () => {
  let testCategory: any
  let testProducts: any[] = []
  let testAdminUser: any

  const INITIAL_INVENTORY = 100
  const LOW_STOCK_THRESHOLD = 10
  const LOW_STOCK_LEVEL = 5
  const OUT_OF_STOCK_LEVEL = 0

  beforeAll(async () => {
    if (!runIntegration) {
      return
    }

    // Find or create an active category. A fresh CI database has no seed data,
    // so create one if none exists rather than failing the whole suite.
    testCategory = await prisma.category.findFirst({
      where: { isActive: true }
    })

    if (!testCategory) {
      testCategory = await prisma.category.upsert({
        where: { slug: 'test-inventory-alerts-category' },
        update: {},
        create: { name: 'Test Inventory Alerts Category', slug: 'test-inventory-alerts-category' },
      })
    }

    // Create an admin user for notifications
    testAdminUser = await prisma.user.create({
      data: {
        email: `test-admin-${Date.now()}@example.com`,
        name: 'Test Admin',
        role: UserRole.ADMIN,
      },
    })

    // Create test products
    const productData = [
      {
        name: 'Test Product 1 - Normal Stock',
        slug: `test-alerts-normal-${Date.now()}`,
        sku: `TEST-ALT-N-${Date.now()}`,
        inventory: INITIAL_INVENTORY,
      },
      {
        name: 'Test Product 2 - Low Stock',
        slug: `test-alerts-low-${Date.now()}`,
        sku: `TEST-ALT-L-${Date.now()}`,
        inventory: LOW_STOCK_LEVEL,
      },
      {
        name: 'Test Product 3 - Out of Stock',
        slug: `test-alerts-oos-${Date.now()}`,
        sku: `TEST-ALT-OOS-${Date.now()}`,
        inventory: OUT_OF_STOCK_LEVEL,
      },
    ]

    for (const data of productData) {
      const product = await prisma.product.create({
        data: {
          ...data,
          heatLevel: 'MILD',
          price: 10.00,
          stockReserved: 0,
          stockStatus: 'IN_STOCK',
          lowStockThreshold: LOW_STOCK_THRESHOLD,
          categoryId: testCategory.id,
          ingredients: ['Test ingredient'],
          isActive: true,
        },
      })
      testProducts.push(product)
    }
  })

  afterAll(async () => {
    if (!runIntegration) {
      return
    }

    // Clean up test data
    for (const product of testProducts) {
      await prisma.inventoryAlert.deleteMany({
        where: { productId: product.id }
      })
      await prisma.product.delete({
        where: { id: product.id }
      })
    }

    if (testAdminUser) {
      await prisma.user.delete({
        where: { id: testAdminUser.id }
      })
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should send low stock alert for a single product', async () => {
    const lowStockProduct = testProducts[1]

    // ========================================
    // STEP 1: Send low stock alert
    // ========================================
    const result = await sendLowStockAlert(lowStockProduct.id)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()

    // ========================================
    // STEP 2: Verify alert was created
    // ========================================
    const alert = await prisma.inventoryAlert.findFirst({
      where: {
        productId: lowStockProduct.id,
        type: InventoryAlertType.LOW_STOCK,
      },
      orderBy: { createdAt: 'desc' },
    })

    expect(alert).toBeDefined()
    expect(alert?.status).toBe(InventoryAlertStatus.ACTIVE)
    expect(alert?.stockLevel).toBe(LOW_STOCK_LEVEL)
    expect(alert?.threshold).toBe(LOW_STOCK_THRESHOLD)
    expect(alert?.notifiedAt).toBeDefined()
    expect(alert?.notifiedTo).toBeDefined()
    expect(Array.isArray(alert?.notifiedTo)).toBe(true)

    // ========================================
    // STEP 3: Verify email was sent
    // ========================================
    expect(sendEmail).toHaveBeenCalled()
    const emailCall = vi.mocked(sendEmail).mock.calls[0][0]
    expect(emailCall.to).toBe(testAdminUser.email)
    expect(emailCall.subject).toContain('LOW STOCK ALERT')
    expect(emailCall.subject).toContain(lowStockProduct.name)
  })

  it('should send out of stock alert when inventory is zero', async () => {
    const outOfStockProduct = testProducts[2]

    // ========================================
    // STEP 1: Send alert for out of stock product
    // ========================================
    const result = await sendLowStockAlert(outOfStockProduct.id)

    expect(result.success).toBe(true)

    // ========================================
    // STEP 2: Verify OUT_OF_STOCK alert was created
    // ========================================
    const alert = await prisma.inventoryAlert.findFirst({
      where: {
        productId: outOfStockProduct.id,
        type: InventoryAlertType.OUT_OF_STOCK,
      },
      orderBy: { createdAt: 'desc' },
    })

    expect(alert).toBeDefined()
    expect(alert?.type).toBe(InventoryAlertType.OUT_OF_STOCK)
    expect(alert?.stockLevel).toBe(OUT_OF_STOCK_LEVEL)

    // ========================================
    // STEP 3: Verify email subject indicates out of stock
    // ========================================
    expect(sendEmail).toHaveBeenCalled()
    const emailCall = vi.mocked(sendEmail).mock.calls[0][0]
    expect(emailCall.subject).toContain('OUT OF STOCK')
    expect(emailCall.subject).toContain(outOfStockProduct.name)
  })

  it('should not send alert when product is not low on stock', async () => {
    const normalStockProduct = testProducts[0]

    // ========================================
    // STEP 1: Try to send alert for normal stock product
    // ========================================
    const result = await sendLowStockAlert(normalStockProduct.id)

    expect(result.success).toBe(false)
    expect(result.error).toContain('not low on stock')

    // ========================================
    // STEP 2: Verify no email was sent
    // ========================================
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('should handle non-existent product gracefully', async () => {
    const result = await sendLowStockAlert('non-existent-product-id')

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('should send batch low stock alerts for multiple products', async () => {
    const lowStockProduct = testProducts[1]
    const outOfStockProduct = testProducts[2]

    // Clean up any existing alerts
    await prisma.inventoryAlert.deleteMany({
      where: {
        productId: { in: [lowStockProduct.id, outOfStockProduct.id] }
      }
    })

    vi.clearAllMocks()

    // ========================================
    // STEP 1: Send batch alerts
    // ========================================
    const result = await sendBatchLowStockAlerts([
      lowStockProduct.id,
      outOfStockProduct.id,
    ])

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(2)
    expect(result.results[0].success).toBe(true)
    expect(result.results[0].productId).toBe(lowStockProduct.id)
    expect(result.results[1].success).toBe(true)
    expect(result.results[1].productId).toBe(outOfStockProduct.id)

    // ========================================
    // STEP 2: Verify alerts were created for both products
    // ========================================
    const alerts = await prisma.inventoryAlert.findMany({
      where: {
        productId: { in: [lowStockProduct.id, outOfStockProduct.id] }
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
    })

    expect(alerts).toHaveLength(2)

    // ========================================
    // STEP 3: Verify emails were sent for both products
    // ========================================
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })

  it('should send consolidated low stock alert', async () => {
    vi.clearAllMocks()

    // ========================================
    // STEP 1: Send consolidated alert
    // ========================================
    const result = await sendConsolidatedLowStockAlert()

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()

    // ========================================
    // STEP 2: Verify email was sent
    // ========================================
    expect(sendEmail).toHaveBeenCalled()

    // The consolidated email should mention multiple products
    const emailCall = vi.mocked(sendEmail).mock.calls[0][0]
    expect(emailCall.subject).toContain('LOW STOCK ALERT')
    expect(emailCall.subject).toMatch(/\d+ products?/)
  })

  it('should not send consolidated alert when no products are low', async () => {
    // Set all test products to normal stock
    for (const product of testProducts) {
      await prisma.product.update({
        where: { id: product.id },
        data: { inventory: INITIAL_INVENTORY },
      })
    }

    vi.clearAllMocks()

    // ========================================
    // STEP 1: Try to send consolidated alert
    // ========================================
    const result = await sendConsolidatedLowStockAlert()

    expect(result.success).toBe(true)

    // ========================================
    // STEP 2: Verify no email was sent
    // ========================================
    expect(sendEmail).not.toHaveBeenCalled()

    // Restore product inventories
    await prisma.product.update({
      where: { id: testProducts[1].id },
      data: { inventory: LOW_STOCK_LEVEL },
    })
    await prisma.product.update({
      where: { id: testProducts[2].id },
      data: { inventory: OUT_OF_STOCK_LEVEL },
    })
  })

  it('should check and notify low stock products', async () => {
    // Clean up existing alerts
    await prisma.inventoryAlert.deleteMany({
      where: {
        productId: { in: testProducts.map(p => p.id) }
      }
    })

    vi.clearAllMocks()

    // ========================================
    // STEP 1: Run check and notify
    // ========================================
    const result = await checkAndNotifyLowStock()

    expect(result.success).toBe(true)
    expect(result.notifiedCount).toBeGreaterThan(0)
    expect(result.error).toBeUndefined()

    // ========================================
    // STEP 2: Verify alerts were created
    // ========================================
    const alerts = await prisma.inventoryAlert.findMany({
      where: {
        productId: { in: testProducts.map(p => p.id) },
        status: InventoryAlertStatus.ACTIVE,
      },
    })

    // Should have alerts for low stock and out of stock products
    expect(alerts.length).toBeGreaterThanOrEqual(2)
  })

  it('should not send duplicate alerts for products with existing active alerts', async () => {
    const lowStockProduct = testProducts[1]

    // Clean up and create an active alert
    await prisma.inventoryAlert.deleteMany({
      where: { productId: lowStockProduct.id }
    })

    await prisma.inventoryAlert.create({
      data: {
        productId: lowStockProduct.id,
        type: InventoryAlertType.LOW_STOCK,
        status: InventoryAlertStatus.ACTIVE,
        stockLevel: LOW_STOCK_LEVEL,
        threshold: LOW_STOCK_THRESHOLD,
      },
    })

    vi.clearAllMocks()

    // ========================================
    // STEP 1: Run check and notify
    // ========================================
    const result = await checkAndNotifyLowStock()

    expect(result.success).toBe(true)

    // ========================================
    // STEP 2: Verify no new notification was sent for product with active alert
    // ========================================
    const alertCount = await prisma.inventoryAlert.count({
      where: {
        productId: lowStockProduct.id,
        status: InventoryAlertStatus.ACTIVE,
      },
    })

    // Should still have only one active alert
    expect(alertCount).toBe(1)
  })

  it('should handle email sending failures gracefully', async () => {
    const lowStockProduct = testProducts[1]

    // Clean up existing alerts
    await prisma.inventoryAlert.deleteMany({
      where: { productId: lowStockProduct.id }
    })

    // Mock email failure
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('SMTP connection failed'))

    // ========================================
    // STEP 1: Try to send alert with email failure
    // ========================================
    const result = await sendLowStockAlert(lowStockProduct.id)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()

    // Restore email mock
    vi.mocked(sendEmail).mockResolvedValue({ success: true, messageId: 'test-message-id' })
  })

  it('should track notified emails in alert record', async () => {
    const lowStockProduct = testProducts[1]

    // Clean up existing alerts
    await prisma.inventoryAlert.deleteMany({
      where: { productId: lowStockProduct.id }
    })

    vi.clearAllMocks()

    // ========================================
    // STEP 1: Send alert
    // ========================================
    await sendLowStockAlert(lowStockProduct.id)

    // ========================================
    // STEP 2: Verify notifiedTo includes admin email
    // ========================================
    const alert = await prisma.inventoryAlert.findFirst({
      where: {
        productId: lowStockProduct.id,
      },
      orderBy: { createdAt: 'desc' },
    })

    expect(alert?.notifiedTo).toBeDefined()
    expect(Array.isArray(alert?.notifiedTo)).toBe(true)
    expect((alert?.notifiedTo as string[]).length).toBeGreaterThan(0)
    expect((alert?.notifiedTo as string[])).toContain(testAdminUser.email)
  })

  it('should update existing alert instead of creating duplicate', async () => {
    const lowStockProduct = testProducts[1]

    // Clean up and create initial alert
    await prisma.inventoryAlert.deleteMany({
      where: { productId: lowStockProduct.id }
    })

    await prisma.inventoryAlert.create({
      data: {
        productId: lowStockProduct.id,
        type: InventoryAlertType.LOW_STOCK,
        status: InventoryAlertStatus.ACTIVE,
        stockLevel: LOW_STOCK_LEVEL,
        threshold: LOW_STOCK_THRESHOLD,
      },
    })

    const alertCountBefore = await prisma.inventoryAlert.count({
      where: { productId: lowStockProduct.id },
    })

    vi.clearAllMocks()

    // ========================================
    // STEP 1: Send alert again
    // ========================================
    await sendLowStockAlert(lowStockProduct.id)

    // ========================================
    // STEP 2: Verify no duplicate alert was created
    // ========================================
    const alertCountAfter = await prisma.inventoryAlert.count({
      where: { productId: lowStockProduct.id },
    })

    expect(alertCountAfter).toBe(alertCountBefore)

    // ========================================
    // STEP 3: Verify existing alert was updated with notification
    // ========================================
    const alert = await prisma.inventoryAlert.findFirst({
      where: {
        productId: lowStockProduct.id,
      },
      orderBy: { createdAt: 'desc' },
    })

    expect(alert?.notifiedAt).toBeDefined()
    expect(alert?.notifiedTo).toBeDefined()
  })
})
