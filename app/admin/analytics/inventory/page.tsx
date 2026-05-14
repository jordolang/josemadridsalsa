import { redirect } from 'next/navigation';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Archive,
} from 'lucide-react';
import { getCurrentUser, hasPermission } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { InventoryTransactionType } from '@prisma/client';

interface AnalyticsData {
  stats: {
    totalInventoryValue: number;
    totalInventoryUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
    reservedStock: number;
    availableStock: number;
    reservedRatio: number;
  };
  transactionsByType: {
    type: string;
    count: number;
    quantity: number;
  }[];
  inventoryByCategory: {
    category: string;
    totalUnits: number;
    totalValue: number;
    productCount: number;
  }[];
  lowStockProducts: {
    id: string;
    name: string;
    sku: string;
    inventory: number;
    lowStockThreshold: number;
    category: string;
  }[];
  recentTransactions: {
    id: string;
    type: string;
    quantity: number;
    productName: string;
    createdAt: Date;
  }[];
}

async function getAnalyticsData(): Promise<AnalyticsData> {
  // Get all active products with inventory data
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  // Calculate basic stats
  const totalInventoryUnits = products.reduce((sum, p) => sum + p.inventory, 0);
  const totalInventoryValue = products.reduce(
    (sum, p) => sum + p.inventory * (p.price ? p.price.toNumber() : 0),
    0
  );
  const lowStockCount = products.filter(
    (p) => p.inventory > 0 && p.inventory <= p.lowStockThreshold
  ).length;
  const outOfStockCount = products.filter((p) => p.inventory === 0).length;
  const reservedStock = products.reduce((sum, p) => sum + p.stockReserved, 0);
  const availableStock = products.reduce(
    (sum, p) => sum + (p.inventory - p.stockReserved),
    0
  );
  const reservedRatio = totalInventoryUnits > 0 ? (reservedStock / totalInventoryUnits) * 100 : 0;

  // Get low stock products
  const lowStockProducts = products
    .filter((p) => p.inventory > 0 && p.inventory <= p.lowStockThreshold)
    .sort((a, b) => a.inventory - b.inventory)
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      inventory: p.inventory,
      lowStockThreshold: p.lowStockThreshold,
      category: p.category?.name || 'Uncategorized',
    }));

  // Get inventory by category
  const categoryMap = new Map<
    string,
    { totalUnits: number; totalValue: number; productCount: number }
  >();

  products.forEach((p) => {
    const categoryName = p.category?.name || 'Uncategorized';
    const existing = categoryMap.get(categoryName) || {
      totalUnits: 0,
      totalValue: 0,
      productCount: 0,
    };
    categoryMap.set(categoryName, {
      totalUnits: existing.totalUnits + p.inventory,
      totalValue: existing.totalValue + p.inventory * (p.price ? p.price.toNumber() : 0),
      productCount: existing.productCount + 1,
    });
  });

  const inventoryByCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      ...data,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  // Get transactions grouped by type (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      type: true,
      quantity: true,
    },
  });

  const transactionTypeMap = new Map<string, { count: number; quantity: number }>();
  transactions.forEach((t) => {
    const existing = transactionTypeMap.get(t.type) || { count: 0, quantity: 0 };
    transactionTypeMap.set(t.type, {
      count: existing.count + 1,
      quantity: existing.quantity + Math.abs(t.quantity),
    });
  });

  const transactionsByType = Array.from(transactionTypeMap.entries())
    .map(([type, data]) => ({
      type,
      ...data,
    }))
    .sort((a, b) => b.count - a.count);

  // Get recent transactions
  const recentTransactionsData = await prisma.inventoryTransaction.findMany({
    take: 10,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      product: {
        select: {
          name: true,
        },
      },
    },
  });

  const recentTransactions = recentTransactionsData.map((t) => ({
    id: t.id,
    type: t.type,
    quantity: t.quantity,
    productName: t.product.name,
    createdAt: t.createdAt,
  }));

  return {
    stats: {
      totalInventoryValue,
      totalInventoryUnits,
      lowStockCount,
      outOfStockCount,
      reservedStock,
      availableStock,
      reservedRatio,
    },
    transactionsByType,
    inventoryByCategory,
    lowStockProducts,
    recentTransactions,
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default async function InventoryAnalyticsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const canRead = await hasPermission(user, 'products:read');

  if (!canRead) {
    redirect('/admin');
  }

  const data = await getAnalyticsData();

  const chartConfig = {
    count: {
      label: 'Transactions',
      color: 'hsl(var(--chart-1))',
    },
  };

  const categoryChartConfig = {
    totalValue: {
      label: 'Inventory Value',
      color: 'hsl(var(--chart-2))',
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive inventory metrics and trends
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(data.stats.totalInventoryValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.stats.totalInventoryUnits.toLocaleString()} total units
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reserved Stock</CardTitle>
            <Archive className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {data.stats.reservedStock.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.stats.reservedRatio.toFixed(1)}% of total inventory
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <TrendingDown className="size-4 text-muted-foreground dark:text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-muted-foreground dark:text-muted-foreground">
              {data.stats.lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground">Products below threshold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-destructive">
              {data.stats.outOfStockCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Requiring immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Transaction Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Activity</CardTitle>
            <CardDescription>Last 30 days by transaction type</CardDescription>
          </CardHeader>
          <CardContent>
            {data.transactionsByType.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <BarChart data={data.transactionsByType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="type"
                    tickFormatter={(value) => value.substring(0, 3)}
                  />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No transaction data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Value by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Value by Category</CardTitle>
            <CardDescription>Total inventory value per category</CardDescription>
          </CardHeader>
          <CardContent>
            {data.inventoryByCategory.length > 0 ? (
              <ChartContainer config={categoryChartConfig} className="h-[300px]">
                <BarChart data={data.inventoryByCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="category"
                    tickFormatter={(value) => value.substring(0, 10)}
                  />
                  <YAxis />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Bar
                    dataKey="totalValue"
                    fill="var(--color-totalValue)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Products Table */}
      {data.lowStockProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Low Stock Products</CardTitle>
            <CardDescription>
              Products with inventory below threshold, sorted by urgency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{product.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {product.sku}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {product.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {product.inventory} units
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Threshold: {product.lowStockThreshold}
                      </p>
                    </div>
                    {product.inventory <= product.lowStockThreshold / 2 && (
                      <AlertTriangle className="size-4 text-destructive" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest 10 inventory movements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.recentTransactions.length > 0 ? (
              data.recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {transaction.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(transaction.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        transaction.type === 'SALE' || transaction.type === 'DAMAGED'
                          ? 'destructive'
                          : transaction.type === 'RESTOCK' || transaction.type === 'RETURN'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {transaction.type}
                    </Badge>
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        transaction.quantity < 0 ? 'text-destructive' : 'text-green-600'
                      }`}
                    >
                      {transaction.quantity > 0 ? '+' : ''}
                      {transaction.quantity}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent transactions</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
