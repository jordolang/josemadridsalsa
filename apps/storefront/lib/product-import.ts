import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { getErrorMessage } from '@/lib/errors';
import {
  UNBALANCED_INGREDIENTS_MESSAGE,
  hasBalancedParentheses,
  parseIngredientStatement,
} from '@/lib/ingredients';

// Product import schema for validation
export const ProductImportSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().optional(),
  price: z.coerce.number().positive('Price must be positive'),
  compareAtPrice: z.coerce.number().positive().optional().nullable(),
  costPrice: z.coerce.number().positive().optional().nullable(),
  inventory: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  heatLevel: z.enum(['MILD', 'MEDIUM', 'HOT', 'EXTRA_HOT', 'FRUIT']),
  ingredients: z
    .string()
    .optional()
    .refine((value) => !value || hasBalancedParentheses(value), UNBALANCED_INGREDIENTS_MESSAGE), // Split into an array once valid
  categoryId: z.string().optional(),
  categoryName: z.string().optional(), // Alternative to categoryId
  barcode: z.string().optional().nullable(),
  weight: z.coerce.number().positive().optional().nullable(),
  featuredImage: z.string().transform(val => val === '' ? null : val).optional().nullable(), // URL or relative path
  images: z.string().optional(), // Comma-separated URLs or paths
  isActive: z.union([z.boolean(), z.string()]).transform(val => {
    if (typeof val === 'boolean') return val;
    return val.toLowerCase() === 'true' || val === '1' || val.toLowerCase() === 'yes';
  }).default(true),
  isFeatured: z.union([z.boolean(), z.string()]).transform(val => {
    if (typeof val === 'boolean') return val;
    return val.toLowerCase() === 'true' || val === '1' || val.toLowerCase() === 'yes';
  }).default(false),
  sortOrder: z.coerce.number().int().default(0),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  ogImage: z.string().optional().nullable(), // URL or relative path
  searchKeywords: z.string().optional(), // Comma-separated keywords
});

export type ProductImportData = z.infer<typeof ProductImportSchema>;

/**
 * Type for validated product data ready for database insertion
 */
export interface ValidatedProductData {
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  inventory: number;
  lowStockThreshold: number;
  heatLevel: 'MILD' | 'MEDIUM' | 'HOT' | 'EXTRA_HOT' | 'FRUIT';
  ingredients: string[];
  images: string[];
  searchKeywords: string[];
  categoryId: string;
  barcode: string | null;
  weight: number | null;
  featuredImage: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
}

export interface ImportResult {
  success: boolean;
  data?: unknown[];
  errors?: string[];
  validationErrors?: Array<{ row: number; errors: string[] }>;
  totalRows?: number;
  validRows?: number;
}

export interface ValidationResult {
  success: boolean;
  data?: ValidatedProductData[];
  errors?: string[];
  validationErrors?: Array<{ row: number; errors: string[] }>;
  totalRows?: number;
  validRows?: number;
}

/**
 * Parse JSON file buffer
 */
export async function parseJSON(buffer: Buffer): Promise<ImportResult> {
  try {
    const text = buffer.toString('utf-8');
    const data = JSON.parse(text);
    
    // Handle both array and object with products array
    const products = Array.isArray(data) ? data : data.products;
    
    if (!Array.isArray(products)) {
      return {
        success: false,
        errors: ['Invalid JSON format. Expected an array of products or an object with a "products" array.'],
      };
    }

    return {
      success: true,
      data: products,
      totalRows: products.length,
    };
  } catch (error: unknown) {
    return {
      success: false,
      errors: [`JSON parsing error: ${getErrorMessage(error)}`],
    };
  }
}

/**
 * Parse CSV file buffer
 */
export async function parseCSV(buffer: Buffer): Promise<ImportResult> {
  try {
    const text = buffer.toString('utf-8');
    
    return new Promise((resolve) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        comments: '#',
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            resolve({
              success: false,
              errors: results.errors.map(err => `Row ${err.row}: ${err.message}`),
            });
            return;
          }

          resolve({
            success: true,
            data: results.data,
            totalRows: results.data.length,
          });
        },
        error: (error: Error) => {
          resolve({
            success: false,
            errors: [`CSV parsing error: ${error.message}`],
          });
        },
      });
    });
  } catch (error: unknown) {
    return {
      success: false,
      errors: [`CSV parsing error: ${getErrorMessage(error)}`],
    };
  }
}

/**
 * Parse Excel file buffer
 */
export async function parseExcel(buffer: Buffer): Promise<ImportResult> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    
    // Use the first sheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        success: false,
        errors: ['Excel file is empty or has no sheets'],
      };
    }

    const data: Record<string, unknown>[] = [];
    const headers: string[] = [];

    // Get headers from first row
    worksheet.getRow(1).eachCell((cell) => {
      headers.push(cell.value?.toString() || '');
    });

    // Process data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row

      const rowData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.value !== null && cell.value !== undefined ? cell.value.toString() : null;
        }
      });

      data.push(rowData);
    });

    return {
      success: true,
      data,
      totalRows: data.length,
    };
  } catch (error: unknown) {
    return {
      success: false,
      errors: [`Excel parsing error: ${getErrorMessage(error)}`],
    };
  }
}

/**
 * Validate and transform product data
 */
export function validateProducts(
  rawData: unknown[],
  categories: Map<string, string> // Map of category name to ID
): ValidationResult {
  const validationErrors: Array<{ row: number; errors: string[] }> = [];
  const validProducts: ValidatedProductData[] = [];

  rawData.forEach((row, index) => {
    try {
      // Parse and validate with Zod
      const parsed = ProductImportSchema.parse(row);

      // Handle ingredients (convert string to array). Parsed as a written statement so a
      // sub-ingredient list like "Tomatoes (Water, Citric Acid)" survives, and a pasted label
      // does not leave "and Spices." as the final ingredient.
      const ingredients = parsed.ingredients
        ? parseIngredientStatement(parsed.ingredients)
        : [];

      // Handle images (convert string to array)
      const images = parsed.images
        ? parsed.images
            .split(',')
            .map(i => i.trim())
            .filter(i => i.length > 0)
        : [];

      // Handle search keywords
      const searchKeywords = parsed.searchKeywords
        ? parsed.searchKeywords
            .split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0)
        : [];

      // Handle category - prefer categoryId, fallback to categoryName lookup
      let categoryId: string;
      if (parsed.categoryId) {
        categoryId = parsed.categoryId;
      } else if (parsed.categoryName) {
        const lookupId = categories.get(parsed.categoryName.trim().toLowerCase());
        if (lookupId) {
          categoryId = lookupId;
        } else {
          throw new Error(`Category "${parsed.categoryName}" not found`);
        }
      } else {
        throw new Error('Either categoryId or categoryName is required');
      }

      // Transform data with all required fields
      const product: ValidatedProductData = {
        name: parsed.name,
        slug: parsed.slug,
        sku: parsed.sku,
        description: parsed.description || null,
        price: parsed.price,
        compareAtPrice: parsed.compareAtPrice || null,
        costPrice: parsed.costPrice || null,
        inventory: parsed.inventory,
        lowStockThreshold: parsed.lowStockThreshold,
        heatLevel: parsed.heatLevel,
        barcode: parsed.barcode || null,
        weight: parsed.weight || null,
        featuredImage: parsed.featuredImage || null,
        isActive: parsed.isActive,
        isFeatured: parsed.isFeatured,
        sortOrder: parsed.sortOrder,
        metaTitle: parsed.metaTitle || null,
        metaDescription: parsed.metaDescription || null,
        ogImage: parsed.ogImage || null,
        ingredients,
        images,
        searchKeywords,
        categoryId,
      };

      validProducts.push(product);
    } catch (error: unknown) {
      const errors: string[] = [];

      if (error instanceof z.ZodError) {
        errors.push(...error.issues.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        errors.push(getErrorMessage(error));
      }

      validationErrors.push({
        row: index + 1,
        errors,
      });
    }
  });

  return {
    success: validationErrors.length === 0,
    data: validProducts,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    totalRows: rawData.length,
    validRows: validProducts.length,
  };
}

/**
 * Main function to parse and validate product imports
 */
export async function parseProductImport(
  file: File | Buffer,
  fileType: 'json' | 'csv' | 'excel',
  categories: Map<string, string>
): Promise<ValidationResult> {
  // Convert File to Buffer if needed
  let buffer: Buffer;
  if (file instanceof Buffer) {
    buffer = file;
  } else {
    // File API - convert to Buffer
    const arrayBuffer = await (file as File).arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  }

  // Parse based on file type
  let parseResult: ImportResult;
  switch (fileType) {
    case 'json':
      parseResult = await parseJSON(buffer);
      break;
    case 'csv':
      parseResult = await parseCSV(buffer);
      break;
    case 'excel':
      parseResult = await parseExcel(buffer);
      break;
    default:
      return {
        success: false,
        errors: [`Unsupported file type: ${fileType}`],
      };
  }

  if (!parseResult.success || !parseResult.data) {
    return {
      success: false,
      errors: parseResult.errors,
      validationErrors: parseResult.validationErrors,
      totalRows: parseResult.totalRows,
      validRows: parseResult.validRows,
    };
  }

  // Validate and transform
  return validateProducts(parseResult.data, categories);
}
