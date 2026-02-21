import { NextRequest } from 'next/server';
import { requireAnyPermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { InventoryAlertStatus } from '@prisma/client';

/**
 * GET /api/admin/inventory/report
 * Get a comprehensive inventory report
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAnyPermission(['inventory:read', 'products:read']);

    const [
      allProducts,
      activeAlerts,
      recentTransactions,
      transactionsByType,
    ] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          sku: true,
          inventory: true,
          lowStockThreshold: true,
          price: true,
          costPrice: true,
          category: {
            select: { name: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.inventoryAlert.count({
        where: {
          status: {
            in: [InventoryAlertStatus.ACTIVE, InventoryAlertStatus.ACKNOWLEDGED],
          },
        },
      }),
      prisma.inventoryTransaction.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          type: true,
          quantity: true,
        },
      }),
      prisma.inventoryTransaction.groupBy({
        by: ['type'],
        _count: true,
        _sum: { quantity: true },
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Calculate summary
    const totalProducts = allProducts.length;
    const totalUnits = allProducts.reduce((sum, p) => sum + p.inventory, 0);
    const totalValue = allProducts.reduce((sum, p) => {
      const cost = p.costPrice ? Number(p.costPrice) : Number(p.price);
      return sum + cost * p.inventory;
    }, 0);
    const outOfStock = allProducts.filter((p) => p.inventory === 0);
    const lowStock = allProducts.filter(
      (p) => p.inventory > 0 && p.inventory <= p.lowStockThreshold
    );

    // Category breakdown
    const categoryMap = new Map<string, { count: number; units: number; value: number }>();
    for (const product of allProducts) {
      const cat = product.category.name;
      const existing = categoryMap.get(cat) || { count: 0, units: 0, value: 0 };
      const cost = product.costPrice ? Number(product.costPrice) : Number(product.price);
      categoryMap.set(cat, {
        count: existing.count + 1,
        units: existing.units + product.inventory,
        value: existing.value + cost * product.inventory,
      });
    }

    return ok({
      summary: {
        totalProducts,
        totalUnits,
        totalValue,
        outOfStockCount: outOfStock.length,
        lowStockCount: lowStock.length,
        activeAlerts,
      },
      outOfStock: outOfStock.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
      })),
      lowStock: lowStock.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        inventory: p.inventory,
        threshold: p.lowStockThreshold,
      })),
      categoryBreakdown: Array.from(categoryMap.entries()).map(([name, data]) => ({
        category: name,
        ...data,
      })),
      transactionSummary: transactionsByType.map((t) => ({
        type: t.type,
        count: t._count,
        totalQuantity: t._sum.quantity,
      })),
    });
  } catch (error: any) {
    return fail(error.message, error.status || 500);
  }
}
