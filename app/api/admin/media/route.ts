import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail, parsePagination } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/media
 * List all media with pagination
 */
export async function GET(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('content:read');

    // Parse query params
    const { searchParams } = new URL(req.url);
    const { skip, limit } = parsePagination(req);
    const search = searchParams.get('search') || '';

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { alt: { contains: search, mode: 'insensitive' } },
        { caption: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch media
    const [media, totalCount] = await Promise.all([
      prisma.media.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              mediaTags: true,
            },
          },
        },
      }),
      prisma.media.count({ where }),
    ]);

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'media.list',
      entityType: 'media',
      changes: { search },
    });

    return ok({
      media,
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
 * POST /api/admin/media
 * Create a new media entry (URL-based for now)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('content:write');

    // Parse request body
    const body = await req.json();
    const { url, filename, alt, caption } = body;

    // Validate required fields
    if (!url || !filename) {
      return fail('Missing required fields: url, filename', 400);
    }

    // Determine mime type from URL extension
    const ext = url.split('.').pop()?.toLowerCase();
    let mimeType = 'application/octet-stream';
    if (['jpg', 'jpeg'].includes(ext || '')) mimeType = 'image/jpeg';
    else if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'svg') mimeType = 'image/svg+xml';

    // Create media entry (fileSize set to 0 for URL-based uploads)
    const media = await prisma.media.create({
      data: {
        url,
        filename,
        mimeType,
        fileSize: 0, // Will be populated with actual file uploads later
        alt,
        caption,
      },
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'media.create',
      entityType: 'media',
      entityId: media.id,
      changes: { filename: media.filename, url: media.url },
    });

    return ok({ media }, 201);
  } catch (error: any) {
    console.error('Error creating media:', error);
    return fail(error.message, error.status || 500);
  }
}
