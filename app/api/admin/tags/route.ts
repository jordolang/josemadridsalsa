import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/tags
 * List all tags with usage counts
 */
export async function GET(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('content:read');

    // Parse query params
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || '';

    // Build where clause
    const where: any = {};

    if (type && type !== 'all') {
      where.type = type;
    }

    // Fetch tags with usage counts
    const tags = await prisma.tag.findMany({
      where,
      orderBy: { name: 'asc' },
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

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'tags.list',
      entityType: 'tag',
      changes: { type },
    });

    return ok({ tags });
  } catch (error: any) {
    return fail(error.message, error.status || 500);
  }
}

/**
 * POST /api/admin/tags
 * Create a new tag
 */
export async function POST(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('content:write');

    // Parse request body
    const body = await req.json();
    const { name, slug, type } = body;

    // Validate required fields
    if (!name || !slug || !type) {
      return fail('Missing required fields: name, slug, type', 400);
    }

    // Check for duplicate slug
    const existingTag = await prisma.tag.findUnique({
      where: { slug },
    });

    if (existingTag) {
      return fail('A tag with this slug already exists', 409);
    }

    // Create tag
    const tag = await prisma.tag.create({
      data: {
        name,
        slug,
        type,
      },
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'tags.create',
      entityType: 'tag',
      entityId: tag.id,
      changes: { name: tag.name, slug: tag.slug, type: tag.type },
    });

    return ok({ tag }, 201);
  } catch (error: any) {
    console.error('Error creating tag:', error);
    return fail(error.message, error.status || 500);
  }
}
