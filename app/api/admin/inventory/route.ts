import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import {
  adjustInventory,
  bulkAdjustInventory,
  getLowStockProducts,
  type InventoryAdjustment,
} from '@/lib/inventory-manager';
import { InventoryTransactionType } from '@prisma/client';

/**
 * GET /api/admin/inventory
 * Get low stock products
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission('products:read');

    const lowStockProducts = await getLowStockProducts();

    await logAudit({
      userId: user.id,
      action: 'inventory.list_low_stock',
      entityType: 'product',
    });

    return ok({
      products: lowStockProducts,
      totalCount: lowStockProducts.length,
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
