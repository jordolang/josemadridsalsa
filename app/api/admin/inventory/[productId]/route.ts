import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import {
  getInventoryStatus,
  getInventoryHistory,
  adjustInventory,
} from '@/lib/inventory-manager';
import { InventoryTransactionType } from '@prisma/client';

/**
 * GET /api/admin/inventory/[productId]
 * Get inventory status and history for a specific product
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const user = await requirePermission('products:read');
    const { productId } = await params;

    const { searchParams } = new URL(req.url);
    const historyLimit = parseInt(searchParams.get('historyLimit') || '50', 10);

    // Get inventory status and history in parallel
    const [status, history] = await Promise.all([
      getInventoryStatus(productId),
      getInventoryHistory(productId, historyLimit),
    ]);

    await logAudit({
      userId: user.id,
      action: 'inventory.view_product_status',
      entityType: 'product',
      entityId: productId,
    });

    return ok({
      status,
      history,
    });
  } catch (error: any) {
    return fail(error.message, error.status || 500);
  }
}

/**
 * POST /api/admin/inventory/[productId]
 * Adjust inventory for a specific product
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const user = await requirePermission('products:write');
    const { productId } = await params;

    const body = await req.json();
    const { quantity, type, reason, notes, orderId } = body;

    // Validate input
    if (typeof quantity !== 'number') {
      return fail('quantity must be a number', 400);
    }

    if (!type || !Object.values(InventoryTransactionType).includes(type)) {
      return fail(`Invalid transaction type: ${type}`, 400);
    }

    // Adjust inventory
    const result = await adjustInventory({
      productId,
      quantity,
      type,
      reason,
      notes,
      orderId,
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
      message: 'Inventory adjusted successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error adjusting inventory:', error);
    return fail(error.message, error.status || 500);
  }
}
