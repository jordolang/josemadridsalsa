import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';
import ExcelJS from 'exceljs';

/**
 * GET /api/admin/inventory/export
 * Export inventory as CSV or Excel
 */
export async function GET(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('products:export');

    // Parse query params for filtering
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';
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
      changes: { count: products.length, filters: { search, categoryId, stockStatus }, format },
    });

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
        product.name,
        product.category?.name || '',
        product.inventory,
        product.stockReserved,
        availableStock,
        product.lowStockThreshold,
        product.stockStatus,
      ];
    });

    // Export as Excel
    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Inventory');

      // Add headers with styling
      worksheet.addRow(headers);
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add data rows
      rows.forEach((row) => {
        worksheet.addRow(row);
      });

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      });

      // Generate Excel buffer
      const buffer = await workbook.xlsx.writeBuffer();

      return new Response(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="inventory-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      });
    }

    // Export as CSV (default)
    const csvRows = rows.map((row) =>
      row.map((cell) => (typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell))
    );

    const csv = [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n');

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
