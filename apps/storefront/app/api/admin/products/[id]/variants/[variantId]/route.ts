import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAuditWithRequest } from '@/lib/audit';
import prisma from '@/lib/prisma';

/**
 * PUT /api/admin/products/[id]/variants/[variantId]
 * Update a product variant
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    // Verify permissions
    const user = await requirePermission('products:write');

    const { id, variantId } = await params;

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

    // Verify variant exists and belongs to the product
    const existingVariant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!existingVariant) {
      return fail('Variant not found', 404);
    }

    if (existingVariant.productId !== id) {
      return fail('Variant does not belong to this product', 400);
    }

    // Validate price if provided
    if (price !== null && price !== undefined) {
      if (typeof price !== 'number' || price < 0) {
        return fail('Price must be a positive number', 400);
      }
    }

    // Check for duplicate SKU if provided and changed
    if (sku && sku.trim() && sku.trim() !== existingVariant.sku) {
      const duplicateSku = await prisma.productVariant.findUnique({
        where: { sku: sku.trim() },
      });

      if (duplicateSku) {
        return fail('A variant with this SKU already exists', 409);
      }
    }

    // Update variant
    const variant = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        name: name.trim(),
        type: type.trim(),
        price: price !== null && price !== undefined ? price : null,
        sku: sku && sku.trim() ? sku.trim() : null,
        inStock: inStock !== undefined ? inStock : existingVariant.inStock,
      },
    });

    // Log audit
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'product_variants.update',
        entityType: 'product_variant',
        entityId: variant.id,
        changes: {
          before: {
            name: existingVariant.name,
            type: existingVariant.type,
            price: existingVariant.price,
            sku: existingVariant.sku,
            inStock: existingVariant.inStock,
          },
          after: {
            name: variant.name,
            type: variant.type,
            price: variant.price,
            sku: variant.sku,
            inStock: variant.inStock,
          },
        },
      },
      req
    );

    return ok({
      variant,
      message: 'Variant updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating variant:', error);
    return fail(error.message, error.status || 500);
  }
}

/**
 * DELETE /api/admin/products/[id]/variants/[variantId]
 * Delete a product variant
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    // Verify permissions
    const user = await requirePermission('products:write');

    const { id, variantId } = await params;

    // Verify variant exists and belongs to the product
    const existingVariant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!existingVariant) {
      return fail('Variant not found', 404);
    }

    if (existingVariant.productId !== id) {
      return fail('Variant does not belong to this product', 400);
    }

    // Delete variant
    await prisma.productVariant.delete({
      where: { id: variantId },
    });

    // Log audit
    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'product_variants.delete',
        entityType: 'product_variant',
        entityId: variantId,
        changes: {
          productId: id,
          name: existingVariant.name,
          type: existingVariant.type,
          sku: existingVariant.sku,
        },
      },
      req
    );

    return ok({
      message: 'Variant deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting variant:', error);
    return fail(error.message, error.status || 500);
  }
}
