import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InventoryTransactionType } from '@prisma/client';

// Mock Prisma - must be hoisted to top
vi.mock('@/lib/prisma', () => ({
  default: {
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      fields: {
        lowStockThreshold: 5,
      },
    },
    inventoryTransaction: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    inventoryAlert: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((operations) => {
      if (Array.isArray(operations)) {
        return Promise.all(operations);
      }
      return operations({
        product: { update: vi.fn() },
        inventoryTransaction: { create: vi.fn() },
      });
    }),
  },
}));

// Mock email sending - must be hoisted to top
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Import after mocks are defined
import {
  adjustInventory,
  checkAndCreateAlert,
  sendLowStockEmail,
  getInventoryStatus,
} from '@/lib/inventory-manager';

describe('Inventory Manager - Low Stock Alert Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment variables for testing
    process.env.INVENTORY_ALERT_EMAILS = 'admin@josemadrid.net,inventory@josemadrid.net';
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.INVENTORY_ALERT_EMAILS;
    delete process.env.RESEND_API_KEY;
  });

  describe('Stock Update and Alert Creation Flow', () => {
    it('should create low stock alert when stock falls below threshold', async () => {
      const prisma = (await import('@/lib/prisma')).default;

      // Mock product with stock above threshold
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        name: 'Test Salsa',
        sku: 'TST-001',
        inventory: 12,
        lowStockThreshold: 5,
      } as any);

      // Mock no existing alerts
      vi.mocked(prisma.inventoryAlert.findMany).mockResolvedValue([]);
      vi.mocked(prisma.inventoryAlert.findFirst).mockResolvedValue(null);

      // Mock transaction operations
      vi.mocked(prisma.$transaction).mockResolvedValue([
        { id: 'prod-1', inventory: 3 }, // Updated product
        { id: 'trans-1', quantity: -9, newStock: 3 }, // Transaction record
      ] as any);

      // Mock alert creation
      const mockAlert = {
        id: 'alert-1',
        productId: 'prod-1',
        type: 'LOW_STOCK',
        status: 'ACTIVE',
        stockLevel: 3,
        threshold: 5,
        notifiedAt: null,
        notifiedTo: [],
        product: {
          id: 'prod-1',
          name: 'Test Salsa',
          sku: 'TST-001',
          inventory: 3,
        },
      };

      vi.mocked(prisma.inventoryAlert.create).mockResolvedValue(mockAlert as any);
      vi.mocked(prisma.inventoryAlert.update).mockResolvedValue({
        ...mockAlert,
        notifiedAt: new Date(),
        notifiedTo: ['admin@josemadrid.net', 'inventory@josemadrid.net'],
      } as any);

      // Step 1: Reduce stock below threshold (from 12 to 3)
      const result = await adjustInventory({
        productId: 'prod-1',
        quantity: -9, // Sale of 9 units
        type: InventoryTransactionType.SALE,
        reason: 'Customer purchase',
      });

      // Verify stock was updated
      expect(result.newStock).toBe(3);
      expect(result.previousStock).toBe(12);

      // Step 2: Check and create alert
      const alert = await checkAndCreateAlert('prod-1', 3, 5);

      // Verify alert was created
      expect(alert).toBeDefined();
      expect(alert?.type).toBe('LOW_STOCK');
      expect(alert?.status).toBe('ACTIVE');
      expect(alert?.stockLevel).toBe(3);
      expect(alert?.threshold).toBe(5);
    });

    it('should NOT create duplicate alert if active alert already exists', async () => {
      const prisma = (await import('@/lib/prisma')).default;

      const existingAlert = {
        id: 'alert-1',
        productId: 'prod-1',
        type: 'LOW_STOCK',
        status: 'ACTIVE',
        stockLevel: 3,
        threshold: 5,
        product: {
          id: 'prod-1',
          name: 'Test Salsa',
          sku: 'TST-001',
          inventory: 3,
        },
      };

      // Mock existing active alert
      vi.mocked(prisma.inventoryAlert.findFirst).mockResolvedValue(existingAlert as any);

      // Attempt to create alert when one already exists
      const alert = await checkAndCreateAlert('prod-1', 2, 5);

      // Should return existing alert, not create a new one
      expect(alert).toEqual(existingAlert);
      expect(prisma.inventoryAlert.create).not.toHaveBeenCalled();
    });

    it('should create OUT_OF_STOCK alert when inventory reaches zero', async () => {
      const prisma = (await import('@/lib/prisma')).default;

      vi.mocked(prisma.inventoryAlert.findFirst).mockResolvedValue(null);

      const mockAlert = {
        id: 'alert-2',
        productId: 'prod-1',
        type: 'OUT_OF_STOCK',
        status: 'ACTIVE',
        stockLevel: 0,
        threshold: 5,
        product: {
          id: 'prod-1',
          name: 'Test Salsa',
          sku: 'TST-001',
          inventory: 0,
        },
      };

      vi.mocked(prisma.inventoryAlert.create).mockResolvedValue(mockAlert as any);

      // Check and create alert for out of stock
      const alert = await checkAndCreateAlert('prod-1', 0, 5);

      expect(alert?.type).toBe('OUT_OF_STOCK');
      expect(alert?.stockLevel).toBe(0);
    });
  });

  describe('Email Notification Flow', () => {
    it('should send low stock email notification successfully', async () => {
      const { sendEmail } = await import('@/lib/email');

      const result = await sendLowStockEmail(
        'admin@josemadrid.net',
        'Test Salsa',
        'TST-001',
        'prod-1',
        3,
        'LOW_STOCK',
        5
      );

      // Verify email was sent
      expect(sendEmail).toHaveBeenCalledTimes(1);
      const emailCall = vi.mocked(sendEmail).mock.calls[0][0];

      expect(emailCall.to).toBe('admin@josemadrid.net');
      expect(emailCall.subject).toContain('LOW STOCK ALERT');
      expect(emailCall.subject).toContain('Test Salsa');
      expect(emailCall.html).toContain('Test Salsa');
      expect(emailCall.html).toContain('TST-001');
      expect(emailCall.html).toContain('3'); // Current stock level
      expect(emailCall.html).toContain('5'); // Threshold

      expect(result).toEqual({ success: true });
    });

    it('should send out of stock email with urgent styling', async () => {
      const { sendEmail } = await import('@/lib/email');

      await sendLowStockEmail(
        'admin@josemadrid.net',
        'Test Salsa',
        'TST-001',
        'prod-1',
        0,
        'OUT_OF_STOCK',
        5
      );

      const emailCall = vi.mocked(sendEmail).mock.calls[0][0];

      expect(emailCall.subject).toContain('OUT OF STOCK');
      expect(emailCall.subject).toContain('🚨');
      expect(emailCall.html).toContain('Out of Stock Alert');
    });

    it('should skip email if RESEND_API_KEY is not set', async () => {
      delete process.env.RESEND_API_KEY;
      const { sendEmail } = await import('@/lib/email');

      const result = await sendLowStockEmail(
        'admin@josemadrid.net',
        'Test Salsa',
        'TST-001',
        'prod-1',
        3,
        'LOW_STOCK',
        5
      );

      expect(sendEmail).not.toHaveBeenCalled();
      expect(result).toEqual({ skipped: true });
    });

    it('should handle email send failures gracefully', async () => {
      const { sendEmail } = await import('@/lib/email');
      vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Email service unavailable'));

      const result = await sendLowStockEmail(
        'admin@josemadrid.net',
        'Test Salsa',
        'TST-001',
        'prod-1',
        3,
        'LOW_STOCK',
        5
      );

      expect(result).toEqual({ error: true });
    });
  });

  describe('Alert Prevention and Resolution', () => {
    it('should NOT create alert if stock is above threshold', async () => {
      const alert = await checkAndCreateAlert('prod-1', 10, 5);

      expect(alert).toBeNull();
    });

    it('should prevent duplicate ACKNOWLEDGED alerts', async () => {
      const prisma = (await import('@/lib/prisma')).default;

      const acknowledgedAlert = {
        id: 'alert-1',
        productId: 'prod-1',
        type: 'LOW_STOCK',
        status: 'ACKNOWLEDGED',
        stockLevel: 3,
        threshold: 5,
        product: {
          id: 'prod-1',
          name: 'Test Salsa',
          sku: 'TST-001',
          inventory: 3,
        },
      };

      vi.mocked(prisma.inventoryAlert.findFirst).mockResolvedValue(acknowledgedAlert as any);

      const alert = await checkAndCreateAlert('prod-1', 2, 5);

      // Should return existing alert, not create a new one
      expect(alert).toEqual(acknowledgedAlert);
      expect(prisma.inventoryAlert.create).not.toHaveBeenCalled();
    });

    it('should auto-resolve alerts when stock is replenished above threshold', async () => {
      const prisma = (await import('@/lib/prisma')).default;

      // Mock product with low stock
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        name: 'Test Salsa',
        sku: 'TST-001',
        inventory: 3,
        lowStockThreshold: 5,
      } as any);

      // Mock existing active alert
      vi.mocked(prisma.inventoryAlert.findMany).mockResolvedValue([
        {
          id: 'alert-1',
          productId: 'prod-1',
          type: 'LOW_STOCK',
          status: 'ACTIVE',
          stockLevel: 3,
          threshold: 5,
        } as any,
      ]);

      // Mock transaction operations for restock
      vi.mocked(prisma.$transaction).mockResolvedValue([
        { id: 'prod-1', inventory: 50 }, // Updated product
        { id: 'trans-2', quantity: 47, newStock: 50 }, // Transaction record
      ] as any);

      // Restock the product (increase stock to 50)
      await adjustInventory({
        productId: 'prod-1',
        quantity: 47,
        type: InventoryTransactionType.RESTOCK,
        reason: 'Manual restock',
      });

      // Verify alerts were resolved
      expect(prisma.inventoryAlert.updateMany).toHaveBeenCalledWith({
        where: {
          productId: 'prod-1',
          status: {
            in: ['ACTIVE', 'ACKNOWLEDGED'],
          },
        },
        data: expect.objectContaining({
          status: 'RESOLVED',
          resolutionNotes: 'Stock level returned to normal',
        }),
      });
    });
  });

  describe('Inventory Status Check', () => {
    it('should correctly identify low stock status', async () => {
      const prisma = (await import('@/lib/prisma')).default;

      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        inventory: 3,
        lowStockThreshold: 5,
      } as any);

      const status = await getInventoryStatus('prod-1');

      expect(status.isLowStock).toBe(true);
      expect(status.isOutOfStock).toBe(false);
      expect(status.currentStock).toBe(3);
      expect(status.lowStockThreshold).toBe(5);
    });

    it('should correctly identify out of stock status', async () => {
      const prisma = (await import('@/lib/prisma')).default;

      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        inventory: 0,
        lowStockThreshold: 5,
      } as any);

      const status = await getInventoryStatus('prod-1');

      expect(status.isLowStock).toBe(false); // Out of stock is a separate state
      expect(status.isOutOfStock).toBe(true);
      expect(status.currentStock).toBe(0);
    });

    it('should correctly identify normal stock status', async () => {
      const prisma = (await import('@/lib/prisma')).default;

      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        inventory: 20,
        lowStockThreshold: 5,
      } as any);

      const status = await getInventoryStatus('prod-1');

      expect(status.isLowStock).toBe(false);
      expect(status.isOutOfStock).toBe(false);
      expect(status.currentStock).toBe(20);
    });

    it('should throw error for non-existent product', async () => {
      const prisma = (await import('@/lib/prisma')).default;

      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

      await expect(getInventoryStatus('non-existent')).rejects.toThrow('Product not found');
    });
  });

  describe('Edge Cases', () => {
    it('should prevent negative stock levels', async () => {
      const prisma = (await import('@/lib/prisma')).default;

      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        name: 'Test Salsa',
        sku: 'TST-001',
        inventory: 5,
        lowStockThreshold: 5,
      } as any);

      // Attempt to remove more stock than available
      await expect(
        adjustInventory({
          productId: 'prod-1',
          quantity: -10, // More than current stock of 5
          type: InventoryTransactionType.SALE,
          reason: 'Test sale',
        })
      ).rejects.toThrow('Insufficient inventory');
    });

    it('should handle missing admin email configuration', async () => {
      delete process.env.INVENTORY_ALERT_EMAILS;
      const prisma = (await import('@/lib/prisma')).default;

      vi.mocked(prisma.inventoryAlert.findFirst).mockResolvedValue(null);

      const mockAlert = {
        id: 'alert-1',
        productId: 'prod-1',
        type: 'LOW_STOCK',
        status: 'ACTIVE',
        stockLevel: 3,
        threshold: 5,
        product: {
          id: 'prod-1',
          name: 'Test Salsa',
          sku: 'TST-001',
          inventory: 3,
        },
      };

      vi.mocked(prisma.inventoryAlert.create).mockResolvedValue(mockAlert as any);

      // Should not throw error, just log warning
      const alert = await checkAndCreateAlert('prod-1', 3, 5);
      expect(alert).toBeDefined();
    });

    it('should handle stock exactly at threshold (edge case)', async () => {
      const prisma = (await import('@/lib/prisma')).default;

      vi.mocked(prisma.inventoryAlert.findFirst).mockResolvedValue(null);

      const mockAlert = {
        id: 'alert-1',
        productId: 'prod-1',
        type: 'LOW_STOCK',
        status: 'ACTIVE',
        stockLevel: 5,
        threshold: 5,
        product: {
          id: 'prod-1',
          name: 'Test Salsa',
          sku: 'TST-001',
          inventory: 5,
        },
      };

      vi.mocked(prisma.inventoryAlert.create).mockResolvedValue(mockAlert as any);

      // Stock exactly at threshold should trigger alert
      const alert = await checkAndCreateAlert('prod-1', 5, 5);

      expect(alert).toBeDefined();
      expect(alert?.type).toBe('LOW_STOCK');
    });
  });
});
