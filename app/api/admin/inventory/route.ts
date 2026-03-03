import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail, parsePagination } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import {
  adjustInventory,
  bulkAdjustInventory,
  getLowStockProducts,
  type InventoryAdjustment,
} from '@/lib/inventory-manager';
import { InventoryTransactionType } from '@prisma/client';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/inventory
 * List all products with inventory information, search, filters, and pagination
 */
export async function GET(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('inventory:read');

    // Parse query params
    const { searchParams } = new URL(req.url);
    const { skip, limit } = parsePagination(req);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('category') || '';
    const lowStockOnly = searchParams.get('lowStock') === 'true';
    const outOfStockOnly = searchParams.get('outOfStock') === 'true';
    const active = searchParams.get('active');

    // Build where clause
    const where: any = {};

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Active status filter
    if (active !== null && active !== undefined) {
      where.isActive = active === 'true';
    }

    // Out of stock filter
    if (outOfStockOnly) {
      where.inventory = { lte: 0 };
    }

    // For low stock filter, we need to fetch and filter after query
    // since Prisma doesn't support field-to-field comparison in where clause
    let products;
    let totalCount;

    if (lowStockOnly && !outOfStockOnly) {
      // Use existing getLowStockProducts function and apply additional filters
      const lowStockProducts = await getLowStockProducts();

      // Apply search and category filters manually
      let filteredProducts = lowStockProducts;

      if (search) {
        const searchLower = search.toLowerCase();
        filteredProducts = filteredProducts.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.sku.toLowerCase().includes(searchLower) ||
          (p.description && p.description.toLowerCase().includes(searchLower))
        );
      }

      if (categoryId) {
        filteredProducts = filteredProducts.filter(p => p.categoryId === categoryId);
      }

      if (active !== null && active !== undefined) {
        const isActive = active === 'true';
        filteredProducts = filteredProducts.filter(p => p.isActive === isActive);
      }

      totalCount = filteredProducts.length;
      products = filteredProducts.slice(skip, skip + limit);
    } else {
      // Execute queries in parallel for normal case
      [products, totalCount] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            sku: true,
            inventory: true,
            lowStockThreshold: true,
            price: true,
            isActive: true,
            categoryId: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            inventoryAlerts: {
              where: {
                status: {
                  in: ['ACTIVE', 'ACKNOWLEDGED'],
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
            _count: {
              select: {
                inventoryTransactions: true,
              },
            },
          },
        }),
        prisma.product.count({ where }),
      ]);
    }

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'inventory.list',
      entityType: 'product',
      changes: { search, categoryId, lowStockOnly, outOfStockOnly, active },
    });

    return ok({
      products,
      totalCount,
      page: Math.floor(skip / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error: any) {
    return fail(error.message, error.status || 500);
  }
}

/**
 * POST /api/admin/inventory
 * Adjust inventory for one or more products
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('products:write');

    const body = await req.json();
    const { adjustments } = body;

    // Validate input
    if (!adjustments || !Array.isArray(adjustments) || adjustments.length === 0) {
      return fail('adjustments must be a non-empty array', 400);
    }

    // Validate each adjustment
    for (const adj of adjustments) {
      if (!adj.productId || typeof adj.quantity !== 'number') {
        return fail('Each adjustment must have productId and quantity', 400);
      }

      if (!adj.type || !Object.values(InventoryTransactionType).includes(adj.type)) {
        return fail(`Invalid transaction type: ${adj.type}`, 400);
      }
    }

    // Verify all products exist
    const productIds = adjustments.map((adj: any) => adj.productId);
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });

    if (existingProducts.length !== productIds.length) {
      const existingIds = new Set(existingProducts.map((p) => p.id));
      const missingIds = productIds.filter((id: string) => !existingIds.has(id));
      return fail(`Products not found: ${missingIds.join(', ')}`, 404);
    }

    // Add userId to each adjustment
    const adjustmentsWithUser: InventoryAdjustment[] = adjustments.map((adj: any) => ({
      ...adj,
      userId: user.id,
    }));

    // Process adjustments
    const results = await bulkAdjustInventory(adjustmentsWithUser);

    // Count successes and failures
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'inventory.bulk_adjust',
      entityType: 'product',
      changes: {
        totalAdjustments: adjustments.length,
        successCount,
        failureCount,
      },
    });

    return ok({
      results,
      successCount,
      failureCount,
      totalCount: adjustments.length,
    });
  } catch (error: any) {
    console.error('Error adjusting inventory:', error);
    return fail(error.message, error.status || 500);
  }
}

/**
 * PUT /api/admin/inventory
 * Update inventory for a single product with specified transaction type
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission('products:write');

    const body = await req.json();
    const { productId, quantity, type, reason, notes } = body;

    // Validate input
    if (!productId) {
      return fail('productId is required', 400);
    }

    if (typeof quantity !== 'number') {
      return fail('quantity must be a number', 400);
    }

    if (!type || !Object.values(InventoryTransactionType).includes(type)) {
      return fail(`Invalid transaction type: ${type}`, 400);
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!product) {
      return fail('Product not found', 404);
    }

    // Adjust inventory
    const result = await adjustInventory({
      productId,
      quantity,
      type,
      reason: reason || `Manual ${type.toLowerCase()}`,
      notes,
      userId: user.id,
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'inventory.adjust',
      entityType: 'product',
      entityId: productId,
      changes: {
        type,
        quantity,
        previousStock: result.previousStock,
        newStock: result.newStock,
      },
    });

    return ok({
      message: 'Inventory updated successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error adjusting inventory:', error);
    return fail(error.message, error.status || 500);
  }
}

/**
 * PATCH /api/admin/inventory
 * Quick restock - add stock to a product
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission('products:write');

    const body = await req.json();
    const { productId, quantity, notes } = body;

    // Validate input
    if (!productId) {
      return fail('productId is required', 400);
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      return fail('quantity must be a positive number', 400);
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!product) {
      return fail('Product not found', 404);
    }

    // Adjust inventory
    const result = await adjustInventory({
      productId,
      quantity,
      type: InventoryTransactionType.RESTOCK,
      reason: 'Manual restock',
      notes,
      userId: user.id,
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'inventory.restock',
      entityType: 'product',
      entityId: productId,
      changes: {
        quantity,
        previousStock: result.previousStock,
        newStock: result.newStock,
      },
    });

    return ok({
      message: 'Inventory restocked successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error restocking inventory:', error);
    return fail(error.message, error.status || 500);
  }
}
