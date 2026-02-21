import { NextRequest, NextResponse } from 'next/server';
import { requireAnyPermission } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

/**
 * GET /api/admin/inventory/export
 * Export inventory data as CSV
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAnyPermission(['inventory:export', 'products:export']);

    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
      select: {
        name: true,
        sku: true,
        barcode: true,
        inventory: true,
        lowStockThreshold: true,
        price: true,
        costPrice: true,
        isActive: true,
        category: {
          select: { name: true },
        },
      },
    });

    // Build CSV
    const headers = [
      'Product Name',
      'SKU',
      'Barcode',
      'Category',
      'Current Stock',
      'Low Stock Threshold',
      'Unit Price',
      'Cost Price',
      'Inventory Value',
      'Status',
      'Stock Status',
    ];

    const rows = products.map((p) => {
      const cost = p.costPrice ? Number(p.costPrice) : Number(p.price);
      const value = cost * p.inventory;
      const stockStatus =
        p.inventory === 0
          ? 'Out of Stock'
          : p.inventory <= p.lowStockThreshold
          ? 'Low Stock'
          : 'In Stock';

      return [
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        p.barcode || '',
        p.category.name,
        p.inventory,
        p.lowStockThreshold,
        Number(p.price).toFixed(2),
        p.costPrice ? Number(p.costPrice).toFixed(2) : '',
        value.toFixed(2),
        p.isActive ? 'Active' : 'Inactive',
        stockStatus,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    await logAudit({
      userId: user.id,
      action: 'inventory.export',
      entityType: 'inventory',
      changes: { productCount: products.length },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="inventory-report-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Forbidden') ? 403 : 500 }
    );
  }
}
