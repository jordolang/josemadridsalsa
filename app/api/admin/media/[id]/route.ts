import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/media/[id]
 * Get a single media item by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify permissions
    const user = await requirePermission('content:read');

    const { id } = params;

    // Fetch media with tags
    const media = await prisma.media.findUnique({
      where: { id },
      include: {
        mediaTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!media) {
      return fail('Media not found', 404);
    }

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'media.view',
      entityType: 'media',
      entityId: media.id,
    });

    return ok({ media });
  } catch (error: any) {
    console.error('Error fetching media:', error);
    return fail(error.message, error.status || 500);
  }
}

/**
 * DELETE /api/admin/media/[id]
 * Delete a single media item
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify permissions
    const user = await requirePermission('content:write');

    const { id } = params;

    // Check if media exists
    const existingMedia = await prisma.media.findUnique({
      where: { id },
    });

    if (!existingMedia) {
      return fail('Media not found', 404);
    }

    // Delete media (cascade deletes handled by Prisma schema)
    await prisma.media.delete({
      where: { id },
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'media.delete',
      entityType: 'media',
      entityId: id,
      changes: { filename: existingMedia.filename, url: existingMedia.url },
    });

    return ok({
      message: 'Media deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting media:', error);
    return fail(error.message, error.status || 500);
  }
}
