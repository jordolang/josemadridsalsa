import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/tags/[id]
 * Get a single tag by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify permissions
    const user = await requirePermission('content:read');

    const { id } = await params;

    // Fetch tag with usage counts
    const tag = await prisma.tag.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productTags: true,
            recipeTags: true,
            mediaTags: true,
            eventTags: true,
          },
        },
      },
    });

    if (!tag) {
      return fail('Tag not found', 404);
    }

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'tags.view',
      entityType: 'tag',
      entityId: tag.id,
    });

    return ok({ tag });
  } catch (error: any) {
    console.error('Error fetching tag:', error);
    return fail(error.message, error.status || 500);
  }
}

/**
 * PATCH /api/admin/tags/[id]
 * Update a single tag
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify permissions
    const user = await requirePermission('content:write');

    const { id } = await params;

    // Check if tag exists
    const existingTag = await prisma.tag.findUnique({
      where: { id },
    });

    if (!existingTag) {
      return fail('Tag not found', 404);
    }

    // Parse request body
    const body = await req.json();

    // If slug is being changed, check for duplicates
    if (body.slug && body.slug !== existingTag.slug) {
      const duplicateSlug = await prisma.tag.findUnique({
        where: { slug: body.slug },
      });

      if (duplicateSlug) {
        return fail('A tag with this slug already exists', 409);
      }
    }

    // Update tag
    const tag = await prisma.tag.update({
      where: { id },
      data: body,
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'tags.update',
      entityType: 'tag',
      entityId: tag.id,
      changes: body,
    });

    return ok({ tag });
  } catch (error: any) {
    console.error('Error updating tag:', error);
    return fail(error.message, error.status || 500);
  }
}

/**
 * DELETE /api/admin/tags/[id]
 * Delete a single tag
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify permissions
    const user = await requirePermission('content:write');

    const { id } = await params;

    // Check if tag exists
    const existingTag = await prisma.tag.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productTags: true,
            recipeTags: true,
            mediaTags: true,
            eventTags: true,
          },
        },
      },
    });

    if (!existingTag) {
      return fail('Tag not found', 404);
    }

    const totalUsage =
      existingTag._count.productTags +
      existingTag._count.recipeTags +
      existingTag._count.mediaTags +
      existingTag._count.eventTags;

    // Delete tag (cascade deletes handled by Prisma schema)
    await prisma.tag.delete({
      where: { id },
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'tags.delete',
      entityType: 'tag',
      entityId: id,
      changes: { name: existingTag.name, slug: existingTag.slug, usageCount: totalUsage },
    });

    return ok({
      message: 'Tag deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting tag:', error);
    return fail(error.message, error.status || 500);
  }
}
