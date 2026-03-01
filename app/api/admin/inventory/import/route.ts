import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { adjustInventory } from '@/lib/inventory-manager';
import { InventoryTransactionType } from '@prisma/client';

interface InventoryImportRow {
  sku: string;
  inventory: number;
  lowStockThreshold?: number;
}

interface ImportError {
  row: number;
  sku: string;
  errors: string[];
}

/**
 * POST /api/admin/inventory/import
 * Import inventory updates from CSV or Excel file
 */
export async function POST(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('products:write');

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as 'csv' | 'excel';

    if (!file) {
      return fail('No file provided', 400);
    }

    if (!fileType || !['csv', 'excel'].includes(fileType)) {
      return fail('Invalid file type. Must be csv or excel', 400);
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return fail('File size exceeds 10MB limit', 400);
    }

    // Parse the file
    let importData: InventoryImportRow[] = [];
    const errors: string[] = [];
    const validationErrors: ImportError[] = [];

    if (fileType === 'csv') {
      const text = await file.text();
      const parsed = Papa.parse<InventoryImportRow>(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: 'greedy',
        transformHeader: (header) => header.trim(),
      });

      if (parsed.errors.length > 0) {
        return ok({
          success: false,
          errors: parsed.errors.map(err => `Row ${err.row}: ${err.message}`),
          totalRows: 0,
          updated: 0,
        }, 400);
      }

      importData = parsed.data;
    } else if (fileType === 'excel') {
      try {
        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Load Excel workbook
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);

        // Use the first sheet
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          return fail('Excel file is empty or has no sheets', 400);
        }

        const data: any[] = [];
        const headers: string[] = [];

        // Get headers from first row
        worksheet.getRow(1).eachCell((cell) => {
          headers.push(cell.value?.toString().trim() || '');
        });

        // Process data rows
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row

          const rowData: any = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1];
            if (header) {
              // Handle numeric values properly
              const value = cell.value;
              if (value !== null && value !== undefined) {
                // For inventory and lowStockThreshold, convert to number
                if (header === 'inventory' || header === 'lowStockThreshold') {
                  rowData[header] = typeof value === 'number' ? value : parseFloat(value.toString());
                } else {
                  rowData[header] = value.toString();
                }
              }
            }
          });

          // Only add row if it has data
          if (Object.keys(rowData).length > 0) {
            data.push(rowData);
          }
        });

        importData = data as InventoryImportRow[];
      } catch (error: any) {
        return fail(`Excel parsing error: ${error.message}`, 400);
      }
    }

    if (importData.length === 0) {
      return fail('No data found in file', 400);
    }

    // Validate required columns and data
    const validRows: InventoryImportRow[] = [];
    importData.forEach((row, index) => {
      const rowErrors: string[] = [];

      if (!row.sku || typeof row.sku !== 'string' || row.sku.trim() === '') {
        rowErrors.push('SKU is required');
      }

      if (row.inventory === undefined || row.inventory === null) {
        rowErrors.push('Inventory is required');
      } else if (typeof row.inventory !== 'number' || row.inventory < 0) {
        rowErrors.push('Inventory must be a non-negative number');
      }

      if (row.lowStockThreshold !== undefined && row.lowStockThreshold !== null) {
        if (typeof row.lowStockThreshold !== 'number' || row.lowStockThreshold < 0) {
          rowErrors.push('Low stock threshold must be a non-negative number');
        }
      }

      if (rowErrors.length > 0) {
        validationErrors.push({
          row: index + 2, // +2 because index is 0-based and row 1 is header
          sku: row.sku || 'N/A',
          errors: rowErrors,
        });
      } else {
        validRows.push({
          sku: row.sku.trim(),
          inventory: row.inventory,
          lowStockThreshold: row.lowStockThreshold,
        });
      }
    });

    if (validationErrors.length > 0) {
      return ok({
        success: false,
        errors: [`${validationErrors.length} row(s) have validation errors`],
        validationErrors,
        totalRows: importData.length,
        validRows: validRows.length,
        updated: 0,
      }, 400);
    }

    // Get all SKUs to validate they exist
    const skus = validRows.map(r => r.sku);
    const products = await prisma.product.findMany({
      where: {
        sku: { in: skus },
      },
      select: {
        id: true,
        sku: true,
        inventory: true,
      },
    });

    // Create SKU to product map
    const skuToProduct = new Map(products.map(p => [p.sku, p]));

    // Check for missing SKUs
    const missingSKUs: string[] = [];
    validRows.forEach(row => {
      if (!skuToProduct.has(row.sku)) {
        missingSKUs.push(row.sku);
      }
    });

    if (missingSKUs.length > 0) {
      return ok({
        success: false,
        errors: [
          `${missingSKUs.length} SKU(s) not found in database: ${missingSKUs.slice(0, 10).join(', ')}${missingSKUs.length > 10 ? '...' : ''}`,
        ],
        totalRows: importData.length,
        validRows: validRows.length,
        updated: 0,
      }, 400);
    }

    // Process inventory updates
    const results = {
      updated: 0,
      errors: [] as ImportError[],
    };

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const product = skuToProduct.get(row.sku)!;

      try {
        // Calculate the difference to adjust
        const currentInventory = product.inventory;
        const targetInventory = row.inventory;
        const quantityChange = targetInventory - currentInventory;

        // Only adjust if there's a change
        if (quantityChange !== 0) {
          await adjustInventory({
            productId: product.id,
            quantity: quantityChange,
            type: InventoryTransactionType.IMPORT,
            notes: `Inventory import: ${currentInventory} → ${targetInventory}`,
            userId: user.id,
          });
        }

        // Update low stock threshold if provided
        if (row.lowStockThreshold !== undefined && row.lowStockThreshold !== null) {
          await prisma.product.update({
            where: { id: product.id },
            data: { lowStockThreshold: row.lowStockThreshold },
          });
        }

        results.updated++;
      } catch (error: any) {
        results.errors.push({
          row: i + 2,
          sku: row.sku,
          errors: [error.message || 'Unknown error'],
        });
      }
    }

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'inventory.bulk_import',
      entityType: 'product',
      changes: {
        fileType,
        totalRows: importData.length,
        validRows: validRows.length,
        updated: results.updated,
        errors: results.errors.length,
      },
    });

    // Return results
    if (results.errors.length > 0) {
      return ok({
        success: false,
        message: `Imported ${results.updated} product(s) with ${results.errors.length} error(s)`,
        updated: results.updated,
        errors: [`${results.errors.length} row(s) failed to import`],
        validationErrors: results.errors,
        totalRows: importData.length,
        validRows: validRows.length,
      }, 207); // Multi-Status
    }

    return ok({
      success: true,
      message: `Successfully imported inventory for ${results.updated} product(s)`,
      updated: results.updated,
      totalRows: importData.length,
      validRows: validRows.length,
    }, 200);
  } catch (error: any) {
    console.error('Error importing inventory:', error);
    return fail(error.message || 'An error occurred during import', error.status || 500);
  }
}
