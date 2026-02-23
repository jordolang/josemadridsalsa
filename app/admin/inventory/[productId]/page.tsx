import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { getCurrentUser, hasPermission } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InventoryAdjustmentDialog } from '@/components/admin/inventory/InventoryAdjustmentDialog';

async function getProductInventory(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      inventory: true,
      lowStockThreshold: true,
      price: true,
      costPrice: true,
      isActive: true,
      category: {
        select: { name: true },
      },
    },
  });

  if (!product) return null;

  // Get full transaction history
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Get active alerts
  const alerts = await prisma.inventoryAlert.findMany({
    where: {
      productId,
      status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate stats from transactions
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentTransactions = transactions.filter(
    (t) => new Date(t.createdAt) >= thirtyDaysAgo
  );

  const totalRestocked = recentTransactions
    .filter((t) => t.quantity > 0)
    .reduce((sum, t) => sum + t.quantity, 0);

  const totalSold = recentTransactions
    .filter((t) => t.type === 'SALE')
    .reduce((sum, t) => sum + Math.abs(t.quantity), 0);

  const totalAdjusted = recentTransactions
    .filter((t) => !['SALE', 'RESTOCK'].includes(t.type))
    .reduce((sum, t) => sum + t.quantity, 0);

  return {
    product,
    transactions,
    alerts,
    stats: {
      totalRestocked,
      totalSold,
      totalAdjusted,
      transactionCount: recentTransactions.length,
    },
  };
}

export default async function ProductInventoryPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const canRead = await hasPermission(user, 'inventory:read') || await hasPermission(user, 'products:read');
  const canWrite = await hasPermission(user, 'inventory:write') || await hasPermission(user, 'products:write');

  if (!canRead) {
    redirect('/admin');
  }

  const data = await getProductInventory(productId);
  if (!data) {
    notFound();
  }

  const { product, transactions, alerts, stats } = data;
  const inventoryValue = (product.costPrice ? Number(product.costPrice) : Number(product.price)) * product.inventory;

  const getTransactionTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      SALE: 'bg-blue-100 text-blue-800',
      RESTOCK: 'bg-green-100 text-green-800',
      ADJUSTMENT: 'bg-purple-100 text-purple-800',
      RETURN: 'bg-yellow-100 text-yellow-800',
      DAMAGED: 'bg-red-100 text-red-800',
      SAMPLE: 'bg-orange-100 text-orange-800',
      TRANSFER: 'bg-cyan-100 text-cyan-800',
      INITIAL: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colors[type] || 'bg-gray-100 text-gray-800'}>
        {type}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/inventory">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Inventory
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span>SKU: <span className="font-mono">{product.sku}</span></span>
              {product.barcode && <span>Barcode: {product.barcode}</span>}
              <span>Category: {product.category.name}</span>
              {!product.isActive && <Badge variant="outline">Inactive</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/products/${product.id}/edit`}>Edit Product</Link>
          </Button>
          {canWrite && (
            <InventoryAdjustmentDialog productId={product.id} productName={product.name} />
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Stock</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${
              product.inventory === 0 ? 'text-destructive' :
              product.inventory <= product.lowStockThreshold ? 'text-yellow-600' : ''
            }`}>
              {product.inventory}
            </div>
            <p className="text-xs text-muted-foreground">
              Threshold: {product.lowStockThreshold}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${inventoryValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              @ ${(product.costPrice ? Number(product.costPrice) : Number(product.price)).toFixed(2)}/unit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restocked (30d)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">+{stats.totalRestocked}</div>
            <p className="text-xs text-muted-foreground">Units added</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sold (30d)</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">-{stats.totalSold}</div>
            <p className="text-xs text-muted-foreground">Units sold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movements (30d)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.transactionCount}</div>
            <p className="text-xs text-muted-foreground">Total transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="text-yellow-800">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                  <div>
                    <Badge variant={alert.type === 'OUT_OF_STOCK' ? 'destructive' : 'warning' as any} className={alert.type === 'LOW_STOCK' ? 'bg-yellow-100 text-yellow-800' : ''}>
                      {alert.type === 'OUT_OF_STOCK' ? 'Out of Stock' : 'Low Stock'}
                    </Badge>
                    <span className="ml-2 text-sm text-muted-foreground">
                      Triggered at stock level {alert.stockLevel} (threshold: {alert.threshold})
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Showing last {transactions.length} transactions for this product
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No transaction history</p>
              <p className="text-sm">Stock adjustments will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 border rounded-lg text-sm hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getTransactionTypeBadge(transaction.type)}
                    <div>
                      {transaction.reason && (
                        <span className="font-medium">{transaction.reason}</span>
                      )}
                      {transaction.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">{transaction.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className={`font-semibold ${
                        transaction.quantity > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.previousStock} → {transaction.newStock}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground w-36 text-right">
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
