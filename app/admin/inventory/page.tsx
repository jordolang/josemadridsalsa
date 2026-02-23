import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Package, AlertTriangle, TrendingDown, Bell, DollarSign, Warehouse } from 'lucide-react';
import { getCurrentUser, hasPermission } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InventoryFilters } from '@/components/admin/inventory/InventoryFilters';
import { InventoryPageClient } from '@/components/admin/inventory/InventoryPageClient';
import { InventoryExportButton } from '@/components/admin/inventory/InventoryExportButton';
import { InventoryImportDialog } from '@/components/admin/inventory/InventoryImportDialog';
import { InventoryAlertsTable } from '@/components/admin/inventory/InventoryAlertsTable';
import { InventoryAlertStatus, InventoryAlertType } from '@prisma/client';

interface SearchParams {
  search?: string;
  category?: string;
  stockStatus?: string;
  sort?: string;
  page?: string;
}

async function getInventoryData(searchParams: SearchParams) {
  const page = Number(searchParams.page) || 1;
  const limit = 50;
  const skip = (page - 1) * limit;

  // Build where clause for products
  const where: any = {};

  if (searchParams.search) {
    where.OR = [
      { name: { contains: searchParams.search, mode: 'insensitive' } },
      { sku: { contains: searchParams.search, mode: 'insensitive' } },
    ];
  }

  if (searchParams.category && searchParams.category !== 'all') {
    where.categoryId = searchParams.category;
  }

  if (searchParams.stockStatus && searchParams.stockStatus !== 'all') {
    switch (searchParams.stockStatus) {
      case 'out_of_stock':
        where.inventory = 0;
        break;
      case 'low_stock':
        where.AND = [
          { inventory: { gt: 0 } },
          { inventory: { lte: prisma.product.fields.lowStockThreshold } },
        ];
        break;
      case 'in_stock':
        where.inventory = { gt: prisma.product.fields.lowStockThreshold };
        break;
    }
  }

  // Build orderBy
  let orderBy: any = { name: 'asc' };
  switch (searchParams.sort) {
    case 'name_desc':
      orderBy = { name: 'desc' };
      break;
    case 'stock_asc':
      orderBy = { inventory: 'asc' };
      break;
    case 'stock_desc':
      orderBy = { inventory: 'desc' };
      break;
    case 'sku_asc':
      orderBy = { sku: 'asc' };
      break;
    case 'value_desc':
      orderBy = { inventory: 'desc' };
      break;
  }

  // Fetch all data in parallel
  const [products, totalProducts, categories, activeAlerts, recentTransactions, aggregates] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        name: true,
        sku: true,
        inventory: true,
        lowStockThreshold: true,
        price: true,
        costPrice: true,
        isActive: true,
        category: {
          select: { name: true },
        },
      },
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.inventoryAlert.findMany({
      where: {
        status: {
          in: [InventoryAlertStatus.ACTIVE, InventoryAlertStatus.ACKNOWLEDGED],
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            inventory: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.inventoryTransaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: { name: true, sku: true },
        },
      },
    }),
    prisma.product.aggregate({
      where: { isActive: true },
      _sum: { inventory: true },
      _count: true,
    }),
  ]);

  // Calculate additional stats
  const allActiveProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { inventory: true, lowStockThreshold: true, price: true, costPrice: true },
  });

  const outOfStockCount = allActiveProducts.filter((p) => p.inventory === 0).length;
  const lowStockCount = allActiveProducts.filter(
    (p) => p.inventory > 0 && p.inventory <= p.lowStockThreshold
  ).length;
  const totalInventoryValue = allActiveProducts.reduce((acc, p) => {
    const cost = p.costPrice ? Number(p.costPrice) : Number(p.price);
    return acc + cost * p.inventory;
  }, 0);

  return {
    products,
    totalProducts,
    page,
    totalPages: Math.ceil(totalProducts / limit),
    categories,
    activeAlerts,
    recentTransactions,
    stats: {
      totalActiveProducts: aggregates._count,
      totalUnits: aggregates._sum.inventory || 0,
      outOfStockCount,
      lowStockCount,
      totalInventoryValue,
      activeAlertsCount: activeAlerts.length,
    },
  };
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const canRead = await hasPermission(user, 'inventory:read') || await hasPermission(user, 'products:read');
  const canWrite = await hasPermission(user, 'inventory:write') || await hasPermission(user, 'products:write');
  const canExport = await hasPermission(user, 'inventory:export') || await hasPermission(user, 'products:export');
  const canImport = await hasPermission(user, 'inventory:import') || await hasPermission(user, 'products:import');

  if (!canRead) {
    redirect('/admin');
  }

  const {
    products,
    totalProducts,
    page,
    totalPages,
    categories,
    activeAlerts,
    recentTransactions,
    stats,
  } = await getInventoryData(params);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">
            Full product inventory control - view, adjust, import, and export stock levels
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && <InventoryExportButton />}
          {canImport && <InventoryImportDialog />}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActiveProducts}</div>
            <p className="text-xs text-muted-foreground">Active in catalog</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Units</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUnits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all products</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Total stock value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.outOfStockCount}</div>
            <p className="text-xs text-muted-foreground">Needs restocking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lowStockCount}</div>
            <p className="text-xs text-muted-foreground">Below threshold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeAlertsCount}</div>
            <p className="text-xs text-muted-foreground">Pending attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts (collapsible) */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-yellow-600" />
              Active Inventory Alerts ({activeAlerts.length})
            </CardTitle>
            <CardDescription>Products requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <InventoryAlertsTable alerts={activeAlerts} canWrite={canWrite} />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <InventoryFilters categories={categories} />
      </Card>

      {/* Full Inventory Table */}
      <InventoryPageClient products={products} canWrite={canWrite} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, totalProducts)} of {totalProducts} products
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/inventory?page=${page - 1}${params.search ? `&search=${params.search}` : ''}${params.category ? `&category=${params.category}` : ''}${params.stockStatus ? `&stockStatus=${params.stockStatus}` : ''}${params.sort ? `&sort=${params.sort}` : ''}`}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/inventory?page=${page + 1}${params.search ? `&search=${params.search}` : ''}${params.category ? `&category=${params.category}` : ''}${params.stockStatus ? `&stockStatus=${params.stockStatus}` : ''}${params.sort ? `&sort=${params.sort}` : ''}`}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Inventory Transactions</CardTitle>
          <CardDescription>Last 10 inventory movements</CardDescription>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No recent inventory transactions</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 border rounded-lg text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium">{transaction.product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      SKU: {transaction.product.sku}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">{transaction.type}</Badge>
                    <div className="text-right">
                      <div
                        className={`font-medium ${
                          transaction.quantity > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {transaction.quantity > 0 ? '+' : ''}
                        {transaction.quantity}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.previousStock} → {transaction.newStock}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground w-32 text-right">
                      {new Date(transaction.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
