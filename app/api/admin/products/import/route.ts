import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';
import { parseProductImport, type ValidationResult } from '@/lib/product-import';

/**
 * POST /api/admin/products/import
 * Import products from JSON, CSV, or Excel file
 */
export async function POST(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('products:import');

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as 'json' | 'csv' | 'excel';
    const skipDuplicates = formData.get('skipDuplicates') === 'true';

    if (!file) {
      return fail('No file provided', 400);
    }

    if (!fileType || !['json', 'csv', 'excel'].includes(fileType)) {
      return fail('Invalid file type. Must be json, csv, or excel', 400);
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return fail('File size exceeds 10MB limit', 400);
    }

    // Get categories for validation
    const categories = await prisma.category.findMany({
      select: { id: true, name: true },
    });

    // Build category name to ID map (case-insensitive)
    const categoryMap = new Map<string, string>();
    categories.forEach(cat => {
      categoryMap.set(cat.name.toLowerCase(), cat.id);
    });

    // Parse and validate the file
    const importResult = await parseProductImport(file, fileType, categoryMap);

    if (!importResult.success) {
      return ok({
        success: false,
        errors: importResult.errors,
        validationErrors: importResult.validationErrors,
        totalRows: importResult.totalRows,
        validRows: importResult.validRows,
      }, 400);
    }

    const products = importResult.data!;

    // Check for duplicate SKUs in the import
    const skus = products.map(p => p.sku);
    const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index);
    if (duplicateSkus.length > 0) {
      return ok({
        success: false,
        errors: [`Duplicate SKUs found in import: ${[...new Set(duplicateSkus)].join(', ')}`],
        totalRows: importResult.totalRows,
        validRows: 0,
      }, 400);
    }

    // Check for existing SKUs in database
    const existingProducts = await prisma.product.findMany({
      where: {
        sku: { in: skus },
      },
      select: { sku: true },
    });

    const existingSkus = existingProducts.map(p => p.sku);

    if (existingSkus.length > 0 && !skipDuplicates) {
      return ok({
        success: false,
        errors: [
          `${existingSkus.length} product(s) with duplicate SKUs already exist: ${existingSkus.join(', ')}`,
          'Set skipDuplicates to true to skip these products.',
        ],
        totalRows: importResult.totalRows,
        validRows: 0,
      }, 409);
    }

    // Filter out duplicates if skipDuplicates is true
    const productsToImport = skipDuplicates
      ? products.filter(p => !existingSkus.includes(p.sku))
      : products;

    if (productsToImport.length === 0) {
      return ok({
        success: false,
        errors: ['All products in the import already exist'],
        totalRows: importResult.totalRows,
        validRows: 0,
        skipped: existingSkus.length,
      });
    }

    // Bulk create products
    const result = await prisma.product.createMany({
      data: productsToImport,
      skipDuplicates: true, // Extra safety
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'products.bulk_import',
      entityType: 'product',
      changes: {
        fileType,
        totalRows: importResult.totalRows,
        imported: result.count,
        skipped: existingSkus.length,
      },
    });

    return ok({
      success: true,
      message: `Successfully imported ${result.count} product(s)`,
      imported: result.count,
      skipped: existingSkus.length,
      totalRows: importResult.totalRows,
    }, 201);
  } catch (error: any) {
    console.error('Error importing products:', error);
    return fail(error.message || 'An error occurred during import', error.status || 500);
  }
}
