import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail, parsePagination } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';
import {
  BlobUploadError,
  VERCEL_SERVER_UPLOAD_MAX_BYTES,
  uploadToVercelBlob,
} from '@/lib/blob-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
 * Create a media entry by URL or upload a file to Vercel Blob.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('content:write');

    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return fail('Missing file', 400);
      }

      const alt = (form.get('alt') as string | null) ?? null;
      const caption = (form.get('caption') as string | null) ?? null;
      const upload = await uploadToVercelBlob(file, {
        directory: 'admin-media',
        maxBytes: VERCEL_SERVER_UPLOAD_MAX_BYTES,
      });

      const media = await prisma.media.create({
        data: {
          url: upload.url,
          filename: upload.filename,
          mimeType: upload.mimeType,
          fileSize: upload.fileSize,
          alt,
          caption,
        },
      });

      await logAudit({
        userId: user.id,
        action: 'media.upload',
        entityType: 'media',
        entityId: media.id,
        changes: {
          filename: media.filename,
          url: media.url,
          storage: 'vercel-blob',
        },
      });

      return ok({ media, url: upload.url, isVideo: upload.isVideo }, 201);
    }

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
    if (error instanceof BlobUploadError) {
      return fail(error.message, error.status);
    }
    console.error('Error creating media:', error);
    return fail(error.message, error.status || 500);
  }
}
