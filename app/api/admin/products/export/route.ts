import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/products/export
 * Export products as CSV
 */
export async function GET(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('products:export');

    // Parse query params for filtering
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('category') || '';
    const heatLevel = searchParams.get('heatLevel') || '';
    const active = searchParams.get('active');

    // Build where clause (same as list endpoint)
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (heatLevel) {
      where.heatLevel = heatLevel;
    }

    if (active !== null && active !== undefined) {
      where.isActive = active === 'true';
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
      action: 'products.export',
      entityType: 'product',
      changes: { count: products.length, filters: { search, categoryId, heatLevel, active } },
    });

    // Build CSV content
    const headers = [
      'ID',
      'Name',
      'SKU',
      'Slug',
      'Barcode',
      'Category',
      'Price',
      'Compare At Price',
      'Cost Price',
      'Inventory',
      'Low Stock Threshold',
      'Heat Level',
      'Weight',
      'Is Active',
      'Is Featured',
      'Sort Order',
      'Featured Image',
      'Created At',
      'Updated At',
    ];

    const rows = products.map((product) => [
      product.id,
      `"${product.name.replace(/"/g, '""')}"`,
      product.sku,
      product.slug,
      product.barcode || '',
      product.category ? `"${product.category.name.replace(/"/g, '""')}"` : '',
      product.price.toString(),
      product.compareAtPrice?.toString() || '',
      product.costPrice?.toString() || '',
      product.inventory,
      product.lowStockThreshold,
      product.heatLevel,
      product.weight?.toString() || '',
      product.isActive ? 'Yes' : 'No',
      product.isFeatured ? 'Yes' : 'No',
      product.sortOrder,
      product.featuredImage || '',
      product.createdAt.toISOString(),
      product.updatedAt.toISOString(),
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    // Return CSV file
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="products-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting products:', error);
    return fail(error.message, error.status || 500);
  }
}
