import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Package, AlertTriangle, TrendingUp, TrendingDown, Bell } from 'lucide-react';
import { getCurrentUser, hasPermission } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InventoryAdjustmentDialog } from '@/components/admin/inventory/InventoryAdjustmentDialog';
import { InventoryAlertsTable } from '@/components/admin/inventory/InventoryAlertsTable';
import { InventoryAlertStatus, InventoryAlertType } from '@prisma/client';
import { InventoryClientActions } from '@/app/admin/inventory/client-page';

async function getInventoryData() {
  // Get low stock products
  const lowStockProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      inventory: {
        lte: prisma.product.fields.lowStockThreshold,
      },
    },
    include: {
      category: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      inventory: 'asc',
    },
  });

  // Get active alerts
  const activeAlerts = await prisma.inventoryAlert.findMany({
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
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Get recent inventory transactions
  const recentTransactions = await prisma.inventoryTransaction.findMany({
    take: 10,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      product: {
        select: {
          name: true,
          sku: true,
        },
      },
    },
  });

  // Calculate statistics
  const totalProducts = await prisma.product.count({
    where: { isActive: true },
  });

  const outOfStockCount = lowStockProducts.filter((p) => p.inventory === 0).length;
  const lowStockCount = lowStockProducts.filter(
    (p) => p.inventory > 0 && p.inventory <= p.lowStockThreshold
  ).length;

  const totalInventoryValue = await prisma.product.aggregate({
    _sum: {
      inventory: true,
    },
    where: {
      isActive: true,
    },
  });

  return {
    lowStockProducts,
    activeAlerts,
    recentTransactions,
    stats: {
      totalProducts,
      outOfStockCount,
      lowStockCount,
      totalInventoryUnits: totalInventoryValue._sum.inventory || 0,
    },
  };
}

export default async function InventoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const [canRead, canWrite, canImport, canExport] = await Promise.all([
    hasPermission(user, 'products:read'),
    hasPermission(user, 'products:write'),
    hasPermission(user, 'products:write'),
    hasPermission(user, 'products:export'),
  ]);

  if (!canRead) {
    redirect('/admin');
  }

  const { lowStockProducts, activeAlerts, recentTransactions, stats } = await getInventoryData();

  const outOfStockAlerts = activeAlerts.filter((a) => a.type === InventoryAlertType.OUT_OF_STOCK);
  const lowStockAlerts = activeAlerts.filter((a) => a.type === InventoryAlertType.LOW_STOCK);

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground mt-2">
            Real-time inventory tracking and alerts
          </p>
        </div>
        <InventoryClientActions canImport={canImport} canExport={canExport} />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Active products in catalog</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.outOfStockCount}</div>
            <p className="text-xs text-muted-foreground">Products requiring immediate attention</p>
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
            <div className="text-2xl font-bold">{activeAlerts.length}</div>
            <p className="text-xs text-muted-foreground">Pending inventory alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Active Inventory Alerts</CardTitle>
            <CardDescription>Products requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <InventoryAlertsTable alerts={activeAlerts} canWrite={canWrite} />
          </CardContent>
        </Card>
      )}

      {/* Low Stock Products */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Low Stock Products</CardTitle>
          <CardDescription>
            {lowStockProducts.length} product(s) below stock threshold
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lowStockProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">All products are adequately stocked</p>
              <p className="text-sm">No low stock alerts at this time</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockProducts.map((product) => {
                const isOutOfStock = product.inventory === 0;
                const stockPercentage = (product.inventory / product.lowStockThreshold) * 100;

                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="font-medium hover:underline"
                        >
                          {product.name}
                        </Link>
                        {isOutOfStock ? (
                          <Badge variant="destructive">Out of Stock</Badge>
                        ) : (
                          <Badge variant="warning">Low Stock</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>SKU: {product.sku}</span>
                        <span>Category: {product.category.name}</span>
                        <span>
                          Current Stock:{' '}
                          <span className={isOutOfStock ? 'text-destructive font-medium' : 'text-yellow-600 font-medium'}>
                            {product.inventory}
                          </span>
                        </span>
                        <span>Threshold: {product.lowStockThreshold}</span>
                      </div>
                    </div>
                    {canWrite && (
                      <InventoryAdjustmentDialog productId={product.id} productName={product.name} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
