import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail, parsePagination } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/products
 * List all products with search, filters, and pagination
 */
export async function GET(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('products:read');

    // Parse query params
    const { searchParams } = new URL(req.url);
    const { skip, limit } = parsePagination(req);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('category') || '';
    const heatLevel = searchParams.get('heatLevel') || '';
    const active = searchParams.get('active');

    // Build where clause
    const where: any = {};

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Heat level filter
    if (heatLevel) {
      where.heatLevel = heatLevel;
    }

    // Active status filter
    if (active !== null && active !== undefined) {
      where.isActive = active === 'true';
    }

    // Execute queries in parallel
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'products.list',
      entityType: 'product',
      changes: { search, categoryId, heatLevel, active },
    });

    return ok({
      products,
      totalCount,
      page: Math.floor(skip / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error: any) {
    return fail(error.message, error.status || 500);
  }
}

/**
 * POST /api/admin/products
 * Create a new product
 */
export async function POST(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('products:write');

    // Parse request body
    const body = await req.json();
    const {
      name,
      slug,
      description,
      sku,
      price,
      compareAtPrice,
      costPrice,
      inventory,
      lowStockThreshold,
      weight,
      dimensions,
      heatLevel,
      ingredients,
      categoryId,
      featuredImage,
      images,
      isActive,
      isFeatured,
      sortOrder,
      metaTitle,
      metaDescription,
      ogImage,
      searchKeywords,
      barcode,
    } = body;

    // Validate required fields
    if (!name || !slug || !sku || price === undefined) {
      return fail('Missing required fields: name, slug, sku, price', 400);
    }

    // Check for duplicate SKU
    const existingProduct = await prisma.product.findUnique({
      where: { sku },
    });

    if (existingProduct) {
      return fail('A product with this SKU already exists', 409);
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        sku,
        price,
        compareAtPrice,
        costPrice,
        inventory: inventory ?? 0,
        lowStockThreshold: lowStockThreshold ?? 5,
        weight,
        dimensions,
        heatLevel,
        ingredients: ingredients || [],
        categoryId,
        featuredImage,
        images: images || [],
        isActive: isActive ?? true,
        isFeatured: isFeatured ?? false,
        sortOrder: sortOrder ?? 0,
        metaTitle,
        metaDescription,
        ogImage,
        searchKeywords: searchKeywords || [],
        barcode,
      },
      include: {
        category: true,
      },
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'products.create',
      entityType: 'product',
      entityId: product.id,
      changes: { name: product.name, sku: product.sku },
    });

    return ok({ product }, 201);
  } catch (error: any) {
    console.error('Error creating product:', error);
    return fail(error.message, error.status || 500);
  }
}

/**
 * PATCH /api/admin/products
 * Bulk update multiple products
 */
export async function PATCH(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('products:write');

    // Parse request body
    const body = await req.json();
    const { productIds, updates } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return fail('productIds must be a non-empty array', 400);
    }

    if (!updates || typeof updates !== 'object') {
      return fail('updates must be an object', 400);
    }

    // Perform bulk update
    const result = await prisma.product.updateMany({
      where: {
        id: {
          in: productIds,
        },
      },
      data: updates,
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'products.bulk_update',
      entityType: 'product',
      changes: { productIds, updates, count: result.count },
    });

    return ok({
      message: `${result.count} products updated successfully`,
      count: result.count,
    });
  } catch (error: any) {
    console.error('Error bulk updating products:', error);
    return fail(error.message, error.status || 500);
  }
}

/**
 * DELETE /api/admin/products
 * Bulk delete multiple products
 */
export async function DELETE(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('products:delete');

    // Parse request body
    const body = await req.json();
    const { productIds } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return fail('productIds must be a non-empty array', 400);
    }

    // Delete products (cascade deletes handled by Prisma schema)
    const result = await prisma.product.deleteMany({
      where: {
        id: {
          in: productIds,
        },
      },
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'products.bulk_delete',
      entityType: 'product',
      changes: { productIds, count: result.count },
    });

    return ok({
      message: `${result.count} products deleted successfully`,
      count: result.count,
    });
  } catch (error: any) {
    console.error('Error bulk deleting products:', error);
    return fail(error.message, error.status || 500);
  }
}
