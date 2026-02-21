import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { getCurrentUser, hasPermission } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InventoryPageClient } from '@/components/admin/inventory/InventoryPageClient';
import { InventoryImportDialog } from '@/components/admin/inventory/InventoryImportDialog';

async function getAllProducts() {
  return prisma.product.findMany({
    orderBy: { name: 'asc' },
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
  });
}

export default async function BulkInventoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const canBulk = await hasPermission(user, 'inventory:bulk') || await hasPermission(user, 'products:bulk');
  const canWrite = await hasPermission(user, 'inventory:write') || await hasPermission(user, 'products:write');
  const canImport = await hasPermission(user, 'inventory:import') || await hasPermission(user, 'products:import');

  if (!canBulk) {
    redirect('/admin/inventory');
  }

  const products = await getAllProducts();

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
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PackagePlus className="h-6 w-6" />
              Bulk Inventory Operations
            </h1>
            <p className="text-muted-foreground mt-1">
              Select products and apply bulk stock adjustments, or import from CSV
            </p>
          </div>
        </div>
        {canImport && <InventoryImportDialog />}
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to use bulk operations</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Use the checkboxes to select products you want to adjust</p>
          <p>2. Click the &quot;Bulk Adjust&quot; button that appears above the table</p>
          <p>3. Choose a transaction type and quantity to apply to all selected products</p>
          <p>4. Alternatively, import a CSV file with SKU, Quantity, Type, and Notes columns</p>
        </CardContent>
      </Card>

      {/* Products Table with Selection */}
      <InventoryPageClient products={products} canWrite={canWrite} />
    </div>
  );
}
