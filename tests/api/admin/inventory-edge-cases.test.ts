import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { InventoryTransactionType } from '@prisma/client';

// Mock modules before imports
vi.mock('@/lib/rbac', () => ({
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/inventory-manager', () => ({
  adjustInventory: vi.fn(),
  bulkAdjustInventory: vi.fn(),
  getLowStockProducts: vi.fn().mockResolvedValue([]),
}));

// Import after mocks
import { GET, PUT, POST, PATCH } from '@/app/api/admin/inventory/route';
import { requirePermission } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { adjustInventory, bulkAdjustInventory } from '@/lib/inventory-manager';

describe('Inventory API - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('GET should return error when user is not authenticated', async () => {
      // Mock authentication failure
      const error = new Error('Unauthorized');
      (error as any).status = 401;
      vi.mocked(requirePermission).mockRejectedValue(error);

      const req = new NextRequest('http://localhost:3000/api/admin/inventory');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
      expect(data.error).toContain('Unauthorized');
    });

    it('GET should return error when user lacks inventory:read permission', async () => {
      // Mock forbidden error
      const error = new Error('Forbidden - insufficient permissions');
      (error as any).status = 403;
      vi.mocked(requirePermission).mockRejectedValue(error);

      const req = new NextRequest('http://localhost:3000/api/admin/inventory');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBeDefined();
      expect(data.error).toContain('Forbidden');
    });

    it('PUT should return error when not authenticated', async () => {
      const error = new Error('Unauthorized');
      (error as any).status = 401;
      vi.mocked(requirePermission).mockRejectedValue(error);

      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({
          productId: 'prod-1',
          quantity: 10,
          type: InventoryTransactionType.RESTOCK,
        }),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });

    it('POST should return error when lacking products:write permission', async () => {
      const error = new Error('Forbidden');
      (error as any).status = 403;
      vi.mocked(requirePermission).mockRejectedValue(error);

      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({
          adjustments: [{
            productId: 'prod-1',
            quantity: 10,
            type: InventoryTransactionType.RESTOCK,
          }],
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBeDefined();
    });
  });

  describe('Input Validation - PUT endpoint', () => {
    beforeEach(() => {
      vi.mocked(requirePermission).mockResolvedValue({ id: 'user-1', email: 'admin@test.com' } as any);
    });

    it('should return 400 when productId is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({
          quantity: 10,
          type: InventoryTransactionType.RESTOCK,
        }),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('productId is required');
    });

    it('should return 400 when quantity is not a number', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({
          productId: 'prod-1',
          quantity: 'ten',
          type: InventoryTransactionType.RESTOCK,
        }),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('quantity must be a number');
    });

    it('should return 400 when type is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({
          productId: 'prod-1',
          quantity: 10,
        }),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid transaction type');
    });

    it('should return 400 when type is invalid', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({
          productId: 'prod-1',
          quantity: 10,
          type: 'INVALID_TYPE',
        }),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid transaction type');
    });

    it('should return 404 when product does not exist', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({
          productId: 'non-existent',
          quantity: 10,
          type: InventoryTransactionType.RESTOCK,
        }),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Product not found');
    });

    it('should return 500 when adjustInventory throws unexpected error', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        name: 'Test Product',
      } as any);

      vi.mocked(adjustInventory).mockRejectedValue(new Error('Database error'));

      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({
          productId: 'prod-1',
          quantity: 10,
          type: InventoryTransactionType.RESTOCK,
        }),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Database error');
    });
  });

  describe('Input Validation - POST endpoint (bulk)', () => {
    beforeEach(() => {
      vi.mocked(requirePermission).mockResolvedValue({ id: 'user-1', email: 'admin@test.com' } as any);
    });

    it('should return 400 when adjustments is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('adjustments must be a non-empty array');
    });

    it('should return 400 when adjustments is empty array', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({ adjustments: [] }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('adjustments must be a non-empty array');
    });

    it('should return 400 when adjustment is missing productId', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({
          adjustments: [{
            quantity: 10,
            type: InventoryTransactionType.RESTOCK,
          }],
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('must have productId and quantity');
    });

    it('should return 400 when adjustment has invalid type', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({
          adjustments: [{
            productId: 'prod-1',
            quantity: 10,
            type: 'INVALID',
          }],
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid transaction type');
    });

    it('should return 404 when one or more products do not exist', async () => {
      // Only prod-1 exists
      vi.mocked(prisma.product.findMany).mockResolvedValue([
        { id: 'prod-1' },
      ] as any);

      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({
          adjustments: [
            { productId: 'prod-1', quantity: 10, type: InventoryTransactionType.RESTOCK },
            { productId: 'prod-2', quantity: 5, type: InventoryTransactionType.RESTOCK },
            { productId: 'prod-3', quantity: 3, type: InventoryTransactionType.RESTOCK },
          ],
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Products not found');
      expect(data.error).toContain('prod-2');
      expect(data.error).toContain('prod-3');
    });
  });

  describe('Input Validation - PATCH endpoint (restock)', () => {
    beforeEach(() => {
      vi.mocked(requirePermission).mockResolvedValue({ id: 'user-1', email: 'admin@test.com' } as any);
    });

    it('should return 400 when productId is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PATCH',
        body: JSON.stringify({
          quantity: 10,
        }),
      });

      const response = await PATCH(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('productId is required');
    });

    it('should return 400 when quantity is not positive', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PATCH',
        body: JSON.stringify({
          productId: 'prod-1',
          quantity: 0,
        }),
      });

      const response = await PATCH(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('quantity must be a positive number');
    });

    it('should return 400 when quantity is negative', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PATCH',
        body: JSON.stringify({
          productId: 'prod-1',
          quantity: -10,
        }),
      });

      const response = await PATCH(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('quantity must be a positive number');
    });

    it('should return 404 when product does not exist', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PATCH',
        body: JSON.stringify({
          productId: 'non-existent',
          quantity: 10,
        }),
      });

      const response = await PATCH(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Product not found');
    });
  });

  describe('Negative Stock Prevention', () => {
    beforeEach(() => {
      vi.mocked(requirePermission).mockResolvedValue({ id: 'user-1', email: 'admin@test.com' } as any);
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        name: 'Test Product',
      } as any);
    });

    it('should return error when attempting to reduce stock below zero', async () => {
      // Mock adjustInventory to throw insufficient inventory error
      vi.mocked(adjustInventory).mockRejectedValue(
        new Error('Insufficient inventory for Test Product (SKU: TST-001). Current: 5, Requested: 10')
      );

      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({
          productId: 'prod-1',
          quantity: -10,
          type: InventoryTransactionType.SALE,
          reason: 'Test sale',
        }),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Insufficient inventory');
    });
  });

  describe('Malformed Request Body', () => {
    beforeEach(() => {
      vi.mocked(requirePermission).mockResolvedValue({ id: 'user-1', email: 'admin@test.com' } as any);
    });

    it('should handle invalid JSON with error response', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PUT',
        body: 'invalid json {',
      });

      // JSON parse errors will be caught by the route's error handler
      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(data.error).toBeDefined();
    });

    it('should handle empty body object', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({}),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('productId is required');
    });
  });

  describe('Concurrent Updates Edge Cases', () => {
    beforeEach(() => {
      vi.mocked(requirePermission).mockResolvedValue({ id: 'user-1', email: 'admin@test.com' } as any);
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        name: 'Test Product',
      } as any);
    });

    it('should handle database lock/timeout errors', async () => {
      vi.mocked(adjustInventory).mockRejectedValue(
        new Error('Database lock timeout - transaction failed')
      );

      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({
          productId: 'prod-1',
          quantity: 10,
          type: InventoryTransactionType.RESTOCK,
        }),
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Database lock timeout');
    });

    it('should handle bulk adjustments with partial failures', async () => {
      vi.mocked(prisma.product.findMany).mockResolvedValue([
        { id: 'prod-1' },
        { id: 'prod-2' },
        { id: 'prod-3' },
      ] as any);

      vi.mocked(bulkAdjustInventory).mockResolvedValue([
        { success: true, productId: 'prod-1', newStock: 20, previousStock: 10 } as any,
        { success: false, productId: 'prod-2', error: 'Insufficient inventory' } as any,
        { success: true, productId: 'prod-3', newStock: 15, previousStock: 5 } as any,
      ]);

      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({
          adjustments: [
            { productId: 'prod-1', quantity: 10, type: InventoryTransactionType.RESTOCK },
            { productId: 'prod-2', quantity: -50, type: InventoryTransactionType.SALE },
            { productId: 'prod-3', quantity: 10, type: InventoryTransactionType.RESTOCK },
          ],
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.successCount).toBe(2);
      expect(data.failureCount).toBe(1);
      expect(data.results).toHaveLength(3);
    });
  });

  describe('Missing Environment Variables', () => {
    it('should succeed even when email env vars are missing', async () => {
      // API endpoints should still function even if email config is missing
      // Email notifications will be skipped but inventory operations continue
      vi.mocked(requirePermission).mockResolvedValue({ id: 'user-1', email: 'admin@test.com' } as any);
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        name: 'Test Product',
      } as any);

      vi.mocked(adjustInventory).mockResolvedValue({
        productId: 'prod-1',
        newStock: 20,
        previousStock: 10,
        transaction: { id: 'trans-1' },
      } as any);

      const req = new NextRequest('http://localhost:3000/api/admin/inventory', {
        method: 'PUT',
        body: JSON.stringify({
          productId: 'prod-1',
          quantity: 10,
          type: InventoryTransactionType.RESTOCK,
        }),
      });

      const response = await PUT(req);
      const data = await response.json();

      // Should succeed - email config is optional for inventory operations
      expect(response.status).toBe(200);
      expect(data.message).toContain('updated successfully');
      expect(data.newStock).toBe(20);
      expect(data.previousStock).toBe(10);
    });
  });

  describe('GET Endpoint Edge Cases', () => {
    beforeEach(() => {
      vi.mocked(requirePermission).mockResolvedValue({ id: 'user-1', email: 'admin@test.com' } as any);
    });

    it('should handle empty product list', async () => {
      vi.mocked(prisma.product.findMany).mockResolvedValue([]);
      vi.mocked(prisma.product.count).mockResolvedValue(0);

      const req = new NextRequest('http://localhost:3000/api/admin/inventory');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.products).toEqual([]);
      expect(data.totalCount).toBe(0);
    });

    it('should handle pagination beyond available data', async () => {
      vi.mocked(prisma.product.findMany).mockResolvedValue([]);
      vi.mocked(prisma.product.count).mockResolvedValue(5);

      const req = new NextRequest('http://localhost:3000/api/admin/inventory?page=10&pageSize=20');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.products).toEqual([]);
      expect(data.totalCount).toBe(5);
    });

    it('should handle very large page sizes gracefully', async () => {
      vi.mocked(prisma.product.findMany).mockResolvedValue([]);
      vi.mocked(prisma.product.count).mockResolvedValue(0);

      const req = new NextRequest('http://localhost:3000/api/admin/inventory?pageSize=10000');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      // parsePagination should limit page size
    });
  });
});
