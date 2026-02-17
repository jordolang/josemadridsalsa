import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAuditWithRequest } from '@/lib/audit';
import prisma from '@/lib/prisma';

/**
 * POST /api/admin/products/[id]/variants
 * Create a new product variant
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify permissions
    const user = await requirePermission('products:write');

    const { id } = await params;

    // Parse request body
    const body = await req.json();
    const { name, type, price, sku, inStock } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return fail('Variant name is required', 400);
    }

    if (!type || !type.trim()) {
      return fail('Variant type is required', 400);
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return fail('Product not found', 404);
    }

    // Validate price if provided
    if (price !== null && price !== undefined) {
      if (typeof price !== 'number' || price < 0) {
        return fail('Price must be a positive number', 400);
      }
    }

    // Check for duplicate SKU if provided
    if (sku && sku.trim()) {
      const existingSku = await prisma.productVariant.findUnique({
        where: { sku: sku.trim() },
      });

      if (existingSku) {
        return fail('A variant with this SKU already exists', 409);
      }
    }

    // Create variant
    const variant = await prisma.productVariant.create({
      data: {
        productId: id,
        name: name.trim(),
        type: type.trim(),
        price: price !== null && price !== undefined ? price : null,
        sku: sku && sku.trim() ? sku.trim() : null,
        inStock: inStock !== undefined ? inStock : true,
      },
    });

    // Log audit
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'product_variants.create',
        entityType: 'product_variant',
        entityId: variant.id,
        changes: {
          productId: id,
          name: variant.name,
          type: variant.type,
          price: variant.price,
          sku: variant.sku,
          inStock: variant.inStock,
        },
      },
      req
    );

    return ok(
      {
        variant,
        message: 'Variant created successfully',
      },
      201
    );
  } catch (error: any) {
    console.error('Error creating variant:', error);
    return fail(error.message, error.status || 500);
  }
}

/**
 * GET /api/admin/products/[id]/variants
 * List all variants for a product
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify permissions
    const user = await requirePermission('products:read');

    const { id } = await params;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return fail('Product not found', 404);
    }

    // Fetch variants
    const variants = await prisma.productVariant.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'asc' },
    });

    // Log audit
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'product_variants.list',
        entityType: 'product',
        entityId: id,
        changes: {
          variantCount: variants.length,
        },
      },
      req
    );

    return ok({ variants });
  } catch (error: any) {
    console.error('Error fetching variants:', error);
    return fail(error.message, error.status || 500);
  }
}
