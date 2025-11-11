import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { z } from 'zod';

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
  ingredients: z.string().optional(), // Will be split into array
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

export interface ImportResult {
  success: boolean;
  data?: any[];
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
  } catch (error: any) {
    return {
      success: false,
      errors: [`JSON parsing error: ${error.message}`],
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
  } catch (error: any) {
    return {
      success: false,
      errors: [`CSV parsing error: ${error.message}`],
    };
  }
}

/**
 * Parse Excel file buffer
 */
export async function parseExcel(buffer: Buffer): Promise<ImportResult> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Use the first sheet
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return {
        success: false,
        errors: ['Excel file is empty or has no sheets'],
      };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Convert to strings
      defval: null, // Default value for empty cells
    });

    return {
      success: true,
      data,
      totalRows: data.length,
    };
  } catch (error: any) {
    return {
      success: false,
      errors: [`Excel parsing error: ${error.message}`],
    };
  }
}

/**
 * Validate and transform product data
 */
export function validateProducts(
  rawData: any[],
  categories: Map<string, string> // Map of category name to ID
): ImportResult {
  const validationErrors: Array<{ row: number; errors: string[] }> = [];
  const validProducts: any[] = [];

  rawData.forEach((row, index) => {
    try {
      // Parse and validate with Zod
      const parsed = ProductImportSchema.parse(row);
      
      // Transform data
      const product: any = {
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
      };

      // Handle ingredients (convert string to array)
      if (parsed.ingredients) {
        product.ingredients = parsed.ingredients
          .split(',')
          .map(i => i.trim())
          .filter(i => i.length > 0);
      } else {
        product.ingredients = [];
      }

      // Handle images (convert string to array)
      if (parsed.images) {
        product.images = parsed.images
          .split(',')
          .map(i => i.trim())
          .filter(i => i.length > 0);
      } else {
        product.images = [];
      }

      // Handle search keywords
      if (parsed.searchKeywords) {
        product.searchKeywords = parsed.searchKeywords
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0);
      } else {
        product.searchKeywords = [];
      }

      // Handle category - prefer categoryId, fallback to categoryName lookup
      if (parsed.categoryId) {
        product.categoryId = parsed.categoryId;
      } else if (parsed.categoryName) {
        const categoryId = categories.get(parsed.categoryName.toLowerCase());
        if (categoryId) {
          product.categoryId = categoryId;
        } else {
          throw new Error(`Category "${parsed.categoryName}" not found`);
        }
      } else {
        throw new Error('Either categoryId or categoryName is required');
      }

      validProducts.push(product);
    } catch (error: any) {
      const errors: string[] = [];
      
      if (error instanceof z.ZodError) {
        errors.push(...error.issues.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        errors.push(error.message);
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
): Promise<ImportResult> {
  // Convert File to Buffer if needed
  let buffer: Buffer;
  if (file instanceof Buffer) {
    buffer = file;
  } else {
    const arrayBuffer = await (file as any).arrayBuffer();
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
    return parseResult;
  }

  // Validate and transform
  return validateProducts(parseResult.data, categories);
}
