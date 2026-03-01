import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/inventory/export
 * Export inventory as CSV
 */
export async function GET(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('products:export');

    // Parse query params for filtering
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('category') || '';
    const stockStatus = searchParams.get('stockStatus') || '';

    // Build where clause (same as list endpoint)
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (stockStatus) {
      where.stockStatus = stockStatus;
    }

    // Fetch all products matching filters
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
      },
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'inventory.export',
      entityType: 'product',
      changes: { count: products.length, filters: { search, categoryId, stockStatus } },
    });

    // Build CSV content
    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Current Stock',
      'Reserved Stock',
      'Available Stock',
      'Low Stock Threshold',
      'Stock Status',
    ];

    const rows = products.map((product) => {
      const availableStock = product.inventory - product.stockReserved;

      return [
        product.sku,
        `"${product.name.replace(/"/g, '""')}"`,
        product.category ? `"${product.category.name.replace(/"/g, '""')}"` : '',
        product.inventory,
        product.stockReserved,
        availableStock,
        product.lowStockThreshold,
        product.stockStatus,
      ];
    });

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    // Return CSV file
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="inventory-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting inventory:', error);
    return fail(error.message, error.status || 500);
  }
}
