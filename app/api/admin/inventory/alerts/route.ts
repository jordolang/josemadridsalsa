import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail, parsePagination } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';
import { InventoryAlertStatus } from '@prisma/client';

/**
 * GET /api/admin/inventory/alerts
 * Get all inventory alerts with filtering
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission('products:read');

    const { searchParams } = new URL(req.url);
    const { skip, limit } = parsePagination(req);
    const status = searchParams.get('status') as InventoryAlertStatus | null;
    const productId = searchParams.get('productId');

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (productId) {
      where.productId = productId;
    }

    // Get alerts with product information
    const [alerts, totalCount] = await Promise.all([
      prisma.inventoryAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              inventory: true,
              lowStockThreshold: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.inventoryAlert.count({ where }),
    ]);

    await logAudit({
      userId: user.id,
      action: 'inventory.list_alerts',
      entityType: 'inventoryAlert',
    });

    return ok({
      alerts,
      totalCount,
      page: Math.floor(skip / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error: any) {
    return fail(error.message, error.status || 500);
  }
}
