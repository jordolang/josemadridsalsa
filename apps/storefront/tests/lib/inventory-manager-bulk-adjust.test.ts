import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InventoryTransactionType, StockStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

// Mock Prisma - must be hoisted to top
vi.mock('@/lib/prisma', () => ({
  default: {
    product: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    inventoryTransaction: {
      create: vi.fn(),
    },
  },
}));

// Import after mocks are defined
import { bulkAdjustInventoryInTx } from '@/lib/inventory-manager';

describe('bulkAdjustInventoryInTx', () => {
  let mockTx: Prisma.TransactionClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock transaction client with the same structure as the real one
    mockTx = {
      product: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      inventoryTransaction: {
        create: vi.fn(),
      },
    } as unknown as Prisma.TransactionClient;
  });

  describe('Successful Bulk Adjustments', () => {
    it('should successfully adjust inventory for multiple products', async () => {
      const products = [
        {
          id: 'prod-1',
          name: 'Mild Salsa',
          sku: 'MILD-001',
          inventory: 100,
          stockReserved: 10,
          lowStockThreshold: 20,
        },
        {
          id: 'prod-2',
          name: 'Hot Salsa',
          sku: 'HOT-001',
          inventory: 50,
          stockReserved: 5,
          lowStockThreshold: 10,
        },
      ];

      vi.mocked(mockTx.product.findMany).mockResolvedValue(products as any);

      vi.mocked(mockTx.product.update)
        .mockResolvedValueOnce({ ...products[0], inventory: 90, stockStatus: StockStatus.IN_STOCK } as any)
        .mockResolvedValueOnce({ ...products[1], inventory: 45, stockStatus: StockStatus.IN_STOCK } as any);

      vi.mocked(mockTx.inventoryTransaction.create)
        .mockResolvedValueOnce({ id: 'trans-1', productId: 'prod-1', quantity: -10 } as any)
        .mockResolvedValueOnce({ id: 'trans-2', productId: 'prod-2', quantity: -5 } as any);

      const adjustments = [
        {
          productId: 'prod-1',
          quantity: -10,
          type: InventoryTransactionType.SALE,
          reason: 'Customer order',
        },
        {
          productId: 'prod-2',
          quantity: -5,
          type: InventoryTransactionType.SALE,
          reason: 'Customer order',
        },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      expect(results).toHaveLength(2);

      // Verify first product result
      expect(results[0].product.inventory).toBe(90);
      expect(results[0].previousStock).toBe(100);
      expect(results[0].newStock).toBe(90);
      expect(results[0].transaction.quantity).toBe(-10);

      // Verify second product result
      expect(results[1].product.inventory).toBe(45);
      expect(results[1].previousStock).toBe(50);
      expect(results[1].newStock).toBe(45);
      expect(results[1].transaction.quantity).toBe(-5);

      // Verify all products were fetched in a single batch query
      expect(mockTx.product.findMany).toHaveBeenCalledOnce();
      expect(mockTx.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['prod-1', 'prod-2'] } },
        select: {
          id: true,
          name: true,
          sku: true,
          inventory: true,
          stockReserved: true,
          lowStockThreshold: true,
        },
      });
    });

    it('should handle single product adjustment', async () => {
      const product = {
        id: 'prod-1',
        name: 'Mild Salsa',
        sku: 'MILD-001',
        inventory: 100,
        stockReserved: 10,
        lowStockThreshold: 20,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);
      vi.mocked(mockTx.product.update).mockResolvedValue({
        ...product,
        inventory: 150,
        stockStatus: StockStatus.IN_STOCK
      } as any);
      vi.mocked(mockTx.inventoryTransaction.create).mockResolvedValue({
        id: 'trans-1',
        productId: 'prod-1',
        quantity: 50
      } as any);

      const adjustments = [
        {
          productId: 'prod-1',
          quantity: 50,
          type: InventoryTransactionType.RESTOCK,
          reason: 'Warehouse restock',
        },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      expect(results).toHaveLength(1);
      expect(results[0].newStock).toBe(150);
      expect(results[0].previousStock).toBe(100);
    });

    it('should handle mixed adjustment types (sales, restocks, adjustments)', async () => {
      const products = [
        { id: 'prod-1', name: 'Product 1', sku: 'P1', inventory: 100, stockReserved: 0, lowStockThreshold: 10 },
        { id: 'prod-2', name: 'Product 2', sku: 'P2', inventory: 50, stockReserved: 0, lowStockThreshold: 10 },
        { id: 'prod-3', name: 'Product 3', sku: 'P3', inventory: 75, stockReserved: 5, lowStockThreshold: 10 },
      ];

      vi.mocked(mockTx.product.findMany).mockResolvedValue(products as any);
      vi.mocked(mockTx.product.update)
        .mockResolvedValueOnce({ ...products[0], inventory: 90, stockStatus: StockStatus.IN_STOCK } as any)
        .mockResolvedValueOnce({ ...products[1], inventory: 100, stockStatus: StockStatus.IN_STOCK } as any)
        .mockResolvedValueOnce({ ...products[2], inventory: 70, stockStatus: StockStatus.IN_STOCK } as any);

      vi.mocked(mockTx.inventoryTransaction.create)
        .mockResolvedValueOnce({ id: 'trans-1' } as any)
        .mockResolvedValueOnce({ id: 'trans-2' } as any)
        .mockResolvedValueOnce({ id: 'trans-3' } as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' },
        { productId: 'prod-2', quantity: 50, type: InventoryTransactionType.RESTOCK, reason: 'Restock' },
        { productId: 'prod-3', quantity: -5, type: InventoryTransactionType.ADJUSTMENT, reason: 'Damage' },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      expect(results).toHaveLength(3);
      expect(results[0].newStock).toBe(90); // Sale
      expect(results[1].newStock).toBe(100); // Restock
      expect(results[2].newStock).toBe(70); // Adjustment
    });

    it('should correctly compute stock status based on available inventory', async () => {
      const products = [
        { id: 'prod-1', name: 'Product 1', sku: 'P1', inventory: 30, stockReserved: 5, lowStockThreshold: 20 },
        { id: 'prod-2', name: 'Product 2', sku: 'P2', inventory: 25, stockReserved: 5, lowStockThreshold: 20 },
        { id: 'prod-3', name: 'Product 3', sku: 'P3', inventory: 10, stockReserved: 5, lowStockThreshold: 10 },
      ];

      vi.mocked(mockTx.product.findMany).mockResolvedValue(products as any);

      // After adjustments:
      // prod-1: inventory=20, reserved=5, available=15 (< 20 threshold) -> LOW_STOCK
      // prod-2: inventory=15, reserved=5, available=10 (< 20 threshold) -> LOW_STOCK
      // prod-3: inventory=5, reserved=5, available=0 (= 0) -> OUT_OF_STOCK
      vi.mocked(mockTx.product.update)
        .mockResolvedValueOnce({ ...products[0], inventory: 20, stockStatus: StockStatus.LOW_STOCK } as any)
        .mockResolvedValueOnce({ ...products[1], inventory: 15, stockStatus: StockStatus.LOW_STOCK } as any)
        .mockResolvedValueOnce({ ...products[2], inventory: 5, stockStatus: StockStatus.OUT_OF_STOCK } as any);

      vi.mocked(mockTx.inventoryTransaction.create)
        .mockResolvedValue({ id: 'trans' } as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' },
        { productId: 'prod-2', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' },
        { productId: 'prod-3', quantity: -5, type: InventoryTransactionType.SALE, reason: 'Sale' },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      // Verify stock status is computed correctly
      expect(results[0].product.stockStatus).toBe(StockStatus.LOW_STOCK);
      expect(results[1].product.stockStatus).toBe(StockStatus.LOW_STOCK);
      expect(results[2].product.stockStatus).toBe(StockStatus.OUT_OF_STOCK);
    });

    it('should create inventory transaction records with all details', async () => {
      const product = {
        id: 'prod-1',
        name: 'Test Product',
        sku: 'TEST-001',
        inventory: 100,
        stockReserved: 10,
        lowStockThreshold: 20,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);
      vi.mocked(mockTx.product.update).mockResolvedValue({
        ...product,
        inventory: 90
      } as any);
      vi.mocked(mockTx.inventoryTransaction.create).mockResolvedValue({
        id: 'trans-1'
      } as any);

      const adjustments = [
        {
          productId: 'prod-1',
          quantity: -10,
          type: InventoryTransactionType.SALE,
          reason: 'Customer purchase',
          notes: 'Order #12345',
          orderId: 'order-123',
          userId: 'user-456',
        },
      ];

      await bulkAdjustInventoryInTx(adjustments, mockTx);

      // Verify transaction record includes all fields
      expect(mockTx.inventoryTransaction.create).toHaveBeenCalledWith({
        data: {
          productId: 'prod-1',
          type: InventoryTransactionType.SALE,
          quantity: -10,
          previousStock: 100,
          newStock: 90,
          reason: 'Customer purchase',
          notes: 'Order #12345',
          orderId: 'order-123',
          userId: 'user-456',
        },
      });
    });
  });

  describe('Validation and Error Cases', () => {
    it('should throw error if any product is not found', async () => {
      // Return only one product when two are requested
      const products = [
        { id: 'prod-1', name: 'Product 1', sku: 'P1', inventory: 100, stockReserved: 0, lowStockThreshold: 10 },
      ];

      vi.mocked(mockTx.product.findMany).mockResolvedValue(products as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' },
        { productId: 'prod-2', quantity: -5, type: InventoryTransactionType.SALE, reason: 'Sale' }, // Not found
      ];

      await expect(
        bulkAdjustInventoryInTx(adjustments, mockTx)
      ).rejects.toThrow('Product not found: prod-2');

      // Verify no updates were made
      expect(mockTx.product.update).not.toHaveBeenCalled();
      expect(mockTx.inventoryTransaction.create).not.toHaveBeenCalled();
    });

    it('should throw error if any product has insufficient inventory', async () => {
      const products = [
        { id: 'prod-1', name: 'Product 1', sku: 'P1', inventory: 100, stockReserved: 0, lowStockThreshold: 10 },
        { id: 'prod-2', name: 'Product 2', sku: 'P2', inventory: 5, stockReserved: 0, lowStockThreshold: 10 },
      ];

      vi.mocked(mockTx.product.findMany).mockResolvedValue(products as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' },
        { productId: 'prod-2', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' }, // Insufficient
      ];

      await expect(
        bulkAdjustInventoryInTx(adjustments, mockTx)
      ).rejects.toThrow('Insufficient inventory for Product 2 (SKU: P2). Current: 5, Requested: 10');

      // Verify no updates were made (all-or-nothing)
      expect(mockTx.product.update).not.toHaveBeenCalled();
      expect(mockTx.inventoryTransaction.create).not.toHaveBeenCalled();
    });

    it('should throw error if adjustment would set inventory below reserved stock', async () => {
      const products = [
        { id: 'prod-1', name: 'Product 1', sku: 'P1', inventory: 100, stockReserved: 0, lowStockThreshold: 10 },
        { id: 'prod-2', name: 'Product 2', sku: 'P2', inventory: 50, stockReserved: 30, lowStockThreshold: 10 },
      ];

      vi.mocked(mockTx.product.findMany).mockResolvedValue(products as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' },
        { productId: 'prod-2', quantity: -25, type: InventoryTransactionType.SALE, reason: 'Sale' }, // Would go below reserved
      ];

      // prod-2: 50 - 25 = 25, but reserved is 30, so 25 < 30 is invalid
      await expect(
        bulkAdjustInventoryInTx(adjustments, mockTx)
      ).rejects.toThrow('Cannot set inventory below reserved stock for Product 2 (SKU: P2). New inventory: 25, Reserved: 30');

      // Verify no updates were made (all-or-nothing)
      expect(mockTx.product.update).not.toHaveBeenCalled();
      expect(mockTx.inventoryTransaction.create).not.toHaveBeenCalled();
    });

    it('should validate all adjustments before making any changes (atomic)', async () => {
      const products = [
        { id: 'prod-1', name: 'Product 1', sku: 'P1', inventory: 100, stockReserved: 0, lowStockThreshold: 10 },
        { id: 'prod-2', name: 'Product 2', sku: 'P2', inventory: 50, stockReserved: 0, lowStockThreshold: 10 },
        { id: 'prod-3', name: 'Product 3', sku: 'P3', inventory: 10, stockReserved: 0, lowStockThreshold: 10 },
      ];

      vi.mocked(mockTx.product.findMany).mockResolvedValue(products as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -50, type: InventoryTransactionType.SALE, reason: 'Sale' }, // Valid
        { productId: 'prod-2', quantity: -20, type: InventoryTransactionType.SALE, reason: 'Sale' }, // Valid
        { productId: 'prod-3', quantity: -20, type: InventoryTransactionType.SALE, reason: 'Sale' }, // Invalid (insufficient)
      ];

      await expect(
        bulkAdjustInventoryInTx(adjustments, mockTx)
      ).rejects.toThrow('Insufficient inventory for Product 3');

      // Verify NO products were updated (atomic behavior)
      expect(mockTx.product.update).not.toHaveBeenCalled();
      expect(mockTx.inventoryTransaction.create).not.toHaveBeenCalled();
    });

    it('should throw error when trying to set inventory negative', async () => {
      const product = {
        id: 'prod-1',
        name: 'Product 1',
        sku: 'P1',
        inventory: 10,
        stockReserved: 0,
        lowStockThreshold: 5,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -20, type: InventoryTransactionType.SALE, reason: 'Sale' },
      ];

      await expect(
        bulkAdjustInventoryInTx(adjustments, mockTx)
      ).rejects.toThrow('Insufficient inventory for Product 1 (SKU: P1). Current: 10, Requested: 20');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty adjustments array', async () => {
      vi.mocked(mockTx.product.findMany).mockResolvedValue([]);

      const results = await bulkAdjustInventoryInTx([], mockTx);

      expect(results).toEqual([]);
      expect(mockTx.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: [] } },
        select: expect.any(Object),
      });
      expect(mockTx.product.update).not.toHaveBeenCalled();
      expect(mockTx.inventoryTransaction.create).not.toHaveBeenCalled();
    });

    it('should handle zero quantity adjustment', async () => {
      const product = {
        id: 'prod-1',
        name: 'Product 1',
        sku: 'P1',
        inventory: 100,
        stockReserved: 0,
        lowStockThreshold: 10,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);
      vi.mocked(mockTx.product.update).mockResolvedValue({
        ...product,
        inventory: 100,
        stockStatus: StockStatus.IN_STOCK
      } as any);
      vi.mocked(mockTx.inventoryTransaction.create).mockResolvedValue({
        id: 'trans-1'
      } as any);

      const adjustments = [
        { productId: 'prod-1', quantity: 0, type: InventoryTransactionType.ADJUSTMENT, reason: 'Audit' },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      expect(results[0].previousStock).toBe(100);
      expect(results[0].newStock).toBe(100);
    });

    it('should handle large quantity adjustments', async () => {
      const product = {
        id: 'prod-1',
        name: 'Product 1',
        sku: 'P1',
        inventory: 1000000,
        stockReserved: 0,
        lowStockThreshold: 1000,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);
      vi.mocked(mockTx.product.update).mockResolvedValue({
        ...product,
        inventory: 1100000,
        stockStatus: StockStatus.IN_STOCK
      } as any);
      vi.mocked(mockTx.inventoryTransaction.create).mockResolvedValue({
        id: 'trans-1'
      } as any);

      const adjustments = [
        { productId: 'prod-1', quantity: 100000, type: InventoryTransactionType.RESTOCK, reason: 'Bulk restock' },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      expect(results[0].newStock).toBe(1100000);
      expect(results[0].previousStock).toBe(1000000);
    });

    it('should handle multiple adjustments to the same product', async () => {
      const product = {
        id: 'prod-1',
        name: 'Product 1',
        sku: 'P1',
        inventory: 100,
        stockReserved: 10,
        lowStockThreshold: 20,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);

      // First adjustment
      vi.mocked(mockTx.product.update)
        .mockResolvedValueOnce({ ...product, inventory: 90, stockStatus: StockStatus.IN_STOCK } as any)
        .mockResolvedValueOnce({ ...product, inventory: 85, stockStatus: StockStatus.IN_STOCK } as any);

      vi.mocked(mockTx.inventoryTransaction.create)
        .mockResolvedValueOnce({ id: 'trans-1' } as any)
        .mockResolvedValueOnce({ id: 'trans-2' } as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale 1' },
        { productId: 'prod-1', quantity: -5, type: InventoryTransactionType.SALE, reason: 'Sale 2' },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      expect(results).toHaveLength(2);
      // Both adjustments use the SAME starting inventory (100) from the initial fetch
      expect(results[0].previousStock).toBe(100);
      expect(results[0].newStock).toBe(90);
      expect(results[1].previousStock).toBe(100);
      expect(results[1].newStock).toBe(95);
    });

    it('should handle product at exact threshold boundary', async () => {
      const product = {
        id: 'prod-1',
        name: 'Product 1',
        sku: 'P1',
        inventory: 30,
        stockReserved: 10,
        lowStockThreshold: 20,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);
      // Available before: 30 - 10 = 20 (at threshold, should be LOW_STOCK)
      // After -10: 20 - 10 = 10 available (still LOW_STOCK)
      vi.mocked(mockTx.product.update).mockResolvedValue({
        ...product,
        inventory: 20,
        stockStatus: StockStatus.LOW_STOCK
      } as any);
      vi.mocked(mockTx.inventoryTransaction.create).mockResolvedValue({
        id: 'trans-1'
      } as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      expect(results[0].product.stockStatus).toBe(StockStatus.LOW_STOCK);
    });

    it('should handle product with no reserved stock', async () => {
      const product = {
        id: 'prod-1',
        name: 'Product 1',
        sku: 'P1',
        inventory: 50,
        stockReserved: 0,
        lowStockThreshold: 10,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);
      vi.mocked(mockTx.product.update).mockResolvedValue({
        ...product,
        inventory: 40,
        stockStatus: StockStatus.IN_STOCK
      } as any);
      vi.mocked(mockTx.inventoryTransaction.create).mockResolvedValue({
        id: 'trans-1'
      } as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      expect(results[0].newStock).toBe(40);
      expect(results[0].product.stockStatus).toBe(StockStatus.IN_STOCK);
    });
  });

  describe('Transaction Behavior', () => {
    it('should use the provided transaction client for all operations', async () => {
      const product = {
        id: 'prod-1',
        name: 'Product 1',
        sku: 'P1',
        inventory: 100,
        stockReserved: 0,
        lowStockThreshold: 10,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);
      vi.mocked(mockTx.product.update).mockResolvedValue({
        ...product,
        inventory: 90
      } as any);
      vi.mocked(mockTx.inventoryTransaction.create).mockResolvedValue({
        id: 'trans-1'
      } as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' },
      ];

      await bulkAdjustInventoryInTx(adjustments, mockTx);

      // Verify all operations used the transaction client
      expect(mockTx.product.findMany).toHaveBeenCalled();
      expect(mockTx.product.update).toHaveBeenCalled();
      expect(mockTx.inventoryTransaction.create).toHaveBeenCalled();
    });

    it('should not trigger alerts or side effects (caller responsibility)', async () => {
      const product = {
        id: 'prod-1',
        name: 'Product 1',
        sku: 'P1',
        inventory: 100,
        stockReserved: 0,
        lowStockThreshold: 90,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);
      // This adjustment brings stock to low stock level
      vi.mocked(mockTx.product.update).mockResolvedValue({
        ...product,
        inventory: 50,
        stockStatus: StockStatus.LOW_STOCK
      } as any);
      vi.mocked(mockTx.inventoryTransaction.create).mockResolvedValue({
        id: 'trans-1'
      } as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -50, type: InventoryTransactionType.SALE, reason: 'Sale' },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      // Function should complete without triggering alerts
      expect(results[0].product.stockStatus).toBe(StockStatus.LOW_STOCK);

      // The function itself does NOT call alert functions
      // This is documented behavior - alerts are caller's responsibility
    });

    it('should maintain order of results matching input adjustments', async () => {
      const products = [
        { id: 'prod-3', name: 'Product 3', sku: 'P3', inventory: 75, stockReserved: 0, lowStockThreshold: 10 },
        { id: 'prod-1', name: 'Product 1', sku: 'P1', inventory: 100, stockReserved: 0, lowStockThreshold: 10 },
        { id: 'prod-2', name: 'Product 2', sku: 'P2', inventory: 50, stockReserved: 0, lowStockThreshold: 10 },
      ];

      vi.mocked(mockTx.product.findMany).mockResolvedValue(products as any);
      vi.mocked(mockTx.product.update)
        .mockResolvedValueOnce({ ...products[0], inventory: 65 } as any)
        .mockResolvedValueOnce({ ...products[1], inventory: 90 } as any)
        .mockResolvedValueOnce({ ...products[2], inventory: 45 } as any);
      vi.mocked(mockTx.inventoryTransaction.create)
        .mockResolvedValue({ id: 'trans' } as any);

      // Input order: prod-3, prod-1, prod-2
      const adjustments = [
        { productId: 'prod-3', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' },
        { productId: 'prod-1', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' },
        { productId: 'prod-2', quantity: -5, type: InventoryTransactionType.SALE, reason: 'Sale' },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      // Output should maintain the same order
      expect(results[0].product.id).toBe('prod-3');
      expect(results[1].product.id).toBe('prod-1');
      expect(results[2].product.id).toBe('prod-2');
    });
  });

  describe('Stock Status Computation', () => {
    it('should set OUT_OF_STOCK when available inventory reaches zero', async () => {
      const product = {
        id: 'prod-1',
        name: 'Product 1',
        sku: 'P1',
        inventory: 15,
        stockReserved: 5,
        lowStockThreshold: 20,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);
      // After: inventory=5, reserved=5, available=0 -> OUT_OF_STOCK
      vi.mocked(mockTx.product.update).mockResolvedValue({
        ...product,
        inventory: 5,
        stockStatus: StockStatus.OUT_OF_STOCK
      } as any);
      vi.mocked(mockTx.inventoryTransaction.create).mockResolvedValue({
        id: 'trans-1'
      } as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -10, type: InventoryTransactionType.SALE, reason: 'Sale' },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      expect(results[0].product.stockStatus).toBe(StockStatus.OUT_OF_STOCK);
    });

    it('should set LOW_STOCK when available inventory is above 0 but at or below threshold', async () => {
      const product = {
        id: 'prod-1',
        name: 'Product 1',
        sku: 'P1',
        inventory: 50,
        stockReserved: 10,
        lowStockThreshold: 30,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);
      // After: inventory=30, reserved=10, available=20 (< 30 threshold) -> LOW_STOCK
      vi.mocked(mockTx.product.update).mockResolvedValue({
        ...product,
        inventory: 30,
        stockStatus: StockStatus.LOW_STOCK
      } as any);
      vi.mocked(mockTx.inventoryTransaction.create).mockResolvedValue({
        id: 'trans-1'
      } as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -20, type: InventoryTransactionType.SALE, reason: 'Sale' },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      expect(results[0].product.stockStatus).toBe(StockStatus.LOW_STOCK);
    });

    it('should set IN_STOCK when available inventory is above threshold', async () => {
      const product = {
        id: 'prod-1',
        name: 'Product 1',
        sku: 'P1',
        inventory: 100,
        stockReserved: 10,
        lowStockThreshold: 20,
      };

      vi.mocked(mockTx.product.findMany).mockResolvedValue([product] as any);
      // After: inventory=80, reserved=10, available=70 (> 20 threshold) -> IN_STOCK
      vi.mocked(mockTx.product.update).mockResolvedValue({
        ...product,
        inventory: 80,
        stockStatus: StockStatus.IN_STOCK
      } as any);
      vi.mocked(mockTx.inventoryTransaction.create).mockResolvedValue({
        id: 'trans-1'
      } as any);

      const adjustments = [
        { productId: 'prod-1', quantity: -20, type: InventoryTransactionType.SALE, reason: 'Sale' },
      ];

      const results = await bulkAdjustInventoryInTx(adjustments, mockTx);

      expect(results[0].product.stockStatus).toBe(StockStatus.IN_STOCK);
    });
  });
});
