import { NextRequest } from 'next/server';
import { requireAnyPermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import { adjustInventory } from '@/lib/inventory-manager';
import { prisma } from '@/lib/prisma';
import { InventoryTransactionType } from '@prisma/client';

/**
 * POST /api/admin/inventory/import
 * Import inventory adjustments from CSV file
 * Expected CSV format: SKU, Quantity, Type, Notes
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAnyPermission(['inventory:import', 'products:import']);

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return fail('No file provided', 400);
    }

    if (!file.name.endsWith('.csv')) {
      return fail('Only CSV files are supported', 400);
    }

    const text = await file.text();
    const lines = text.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      return fail('CSV must have a header row and at least one data row', 400);
    }

    // Parse header to determine column positions
    const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const skuIndex = header.findIndex((h) => h === 'sku' || h === 'product_sku');
    const qtyIndex = header.findIndex((h) => h === 'quantity' || h === 'qty' || h === 'stock');
    const typeIndex = header.findIndex((h) => h === 'type' || h === 'transaction_type');
    const notesIndex = header.findIndex((h) => h === 'notes' || h === 'note' || h === 'reason');

    if (skuIndex === -1 || qtyIndex === -1) {
      return fail('CSV must have SKU and Quantity columns', 400);
    }

    const results: Array<{ sku: string; success: boolean; error?: string }> = [];
    const validTypes = Object.values(InventoryTransactionType);

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const sku = cells[skuIndex];
      const quantity = parseInt(cells[qtyIndex], 10);
      const type = typeIndex >= 0 ? cells[typeIndex]?.toUpperCase() : 'RESTOCK';
      const notes = notesIndex >= 0 ? cells[notesIndex] : undefined;

      if (!sku) {
        results.push({ sku: `Row ${i + 1}`, success: false, error: 'Missing SKU' });
        continue;
      }

      if (isNaN(quantity)) {
        results.push({ sku, success: false, error: 'Invalid quantity' });
        continue;
      }

      const txType = validTypes.includes(type as InventoryTransactionType)
        ? (type as InventoryTransactionType)
        : InventoryTransactionType.RESTOCK;

      // Look up product by SKU
      const product = await prisma.product.findUnique({
        where: { sku },
        select: { id: true },
      });

      if (!product) {
        results.push({ sku, success: false, error: 'Product not found' });
        continue;
      }

      try {
        await adjustInventory({
          productId: product.id,
          quantity,
          type: txType,
          reason: `CSV import`,
          notes: notes || undefined,
          userId: user.id,
        });
        results.push({ sku, success: true });
      } catch (error: any) {
        results.push({ sku, success: false, error: error.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    await logAudit({
      userId: user.id,
      action: 'inventory.import',
      entityType: 'inventory',
      changes: {
        fileName: file.name,
        totalRows: results.length,
        successCount,
        failureCount,
      },
    });

    return ok({
      results,
      successCount,
      failureCount,
      totalCount: results.length,
    });
  } catch (error: any) {
    console.error('Error importing inventory:', error);
    return fail(error.message, error.status || 500);
  }
}
