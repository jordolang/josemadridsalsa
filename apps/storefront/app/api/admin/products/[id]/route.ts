import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/products/[id]
 * Get a single product by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify permissions
    const user = await requirePermission('products:read');

    const { id } = await params;

    // Fetch product with relations
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!product) {
      return fail('Product not found', 404);
    }

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'products.view',
      entityType: 'product',
      entityId: product.id,
    });

    return ok({ product });
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return fail(error.message, error.status || 500);
  }
}

/**
 * PATCH /api/admin/products/[id]
 * Update a single product
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify permissions
    const user = await requirePermission('products:write');

    const { id } = await params;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return fail('Product not found', 404);
    }

    // Parse request body
    const body = await req.json();

    // If SKU is being changed, check for duplicates
    if (body.sku && body.sku !== existingProduct.sku) {
      const duplicateSku = await prisma.product.findUnique({
        where: { sku: body.sku },
      });

      if (duplicateSku) {
        return fail('A product with this SKU already exists', 409);
      }
    }

    // Update product
    const product = await prisma.product.update({
      where: { id },
      data: body,
      include: {
        category: true,
      },
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'products.update',
      entityType: 'product',
      entityId: product.id,
      changes: body,
    });

    return ok({ product });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return fail(error.message, error.status || 500);
  }
}

/**
 * DELETE /api/admin/products/[id]
 * Delete a single product
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify permissions
    const user = await requirePermission('products:delete');

    const { id } = await params;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return fail('Product not found', 404);
    }

    // Delete product (cascade deletes handled by Prisma schema)
    await prisma.product.delete({
      where: { id },
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'products.delete',
      entityType: 'product',
      entityId: id,
      changes: { name: existingProduct.name, sku: existingProduct.sku },
    });

    return ok({
      message: 'Product deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return fail(error.message, error.status || 500);
  }
}
