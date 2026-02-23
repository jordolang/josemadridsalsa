import { NextRequest } from 'next/server';
import { requireAnyPermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import {
  adjustInventory,
  bulkAdjustInventory,
  getLowStockProducts,
  type InventoryAdjustment,
} from '@/lib/inventory-manager';
import { prisma } from '@/lib/prisma';
import { InventoryTransactionType } from '@prisma/client';

/**
 * GET /api/admin/inventory
 * Get inventory data - supports full product listing with filters
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAnyPermission(['inventory:read', 'products:read']);

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'low_stock';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const stockStatus = searchParams.get('stockStatus') || '';

    if (mode === 'low_stock') {
      const lowStockProducts = await getLowStockProducts();
      return ok({
        products: lowStockProducts,
        totalCount: lowStockProducts.length,
      });
    }

    // Full inventory mode
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.categoryId = category;
    }

    if (stockStatus === 'out_of_stock') {
      where.inventory = 0;
    } else if (stockStatus === 'low_stock') {
      where.AND = [
        { inventory: { gt: 0 } },
        { inventory: { lte: prisma.product.fields.lowStockThreshold } },
      ];
    } else if (stockStatus === 'in_stock') {
      where.inventory = { gt: prisma.product.fields.lowStockThreshold };
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          sku: true,
          inventory: true,
          lowStockThreshold: true,
          price: true,
          costPrice: true,
          isActive: true,
          category: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    await logAudit({
      userId: user.id,
      action: 'inventory.list',
      entityType: 'product',
    });

    return ok({
      products,
      totalCount: total,
      page,
      totalPages: Math.ceil(total / limit),
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
    const user = await requireAnyPermission(['inventory:write', 'products:write']);

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
 * PATCH /api/admin/inventory
 * Quick restock - add stock to a product
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAnyPermission(['inventory:write', 'products:write']);

    const body = await req.json();
    const { productId, quantity, notes } = body;

    // Validate input
    if (!productId) {
      return fail('productId is required', 400);
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      return fail('quantity must be a positive number', 400);
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
