'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InventoryAdjustmentDialog } from './InventoryAdjustmentDialog';
import { Eye, History } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  inventory: number;
  lowStockThreshold: number;
  price: any;
  costPrice: any;
  isActive: boolean;
  category: {
    name: string;
  };
}

interface InventoryTableProps {
  products: Product[];
  canWrite: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function InventoryTable({ products, canWrite, selectedIds, onSelectionChange }: InventoryTableProps) {
  const router = useRouter();

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(products.map((p) => p.id));
    }
  };

  const getStockBadge = (product: Product) => {
    if (product.inventory === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (product.inventory <= product.lowStockThreshold) {
      return <Badge variant="warning" className="bg-yellow-100 text-yellow-800 border-yellow-300">Low Stock</Badge>;
    }
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">In Stock</Badge>;
  };

  const getInventoryValue = (product: Product) => {
    const cost = product.costPrice ? Number(product.costPrice) : Number(product.price);
    return (cost * product.inventory).toFixed(2);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {canWrite && (
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === products.length && products.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
            )}
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Threshold</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Unit Price</TableHead>
            <TableHead className="text-right">Inventory Value</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canWrite ? 10 : 9} className="text-center py-12 text-muted-foreground">
                No products found matching your filters
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => (
              <TableRow key={product.id} className={product.inventory === 0 ? 'bg-red-50/50' : product.inventory <= product.lowStockThreshold ? 'bg-yellow-50/50' : ''}>
                {canWrite && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(product.id)}
                      onCheckedChange={() => toggleSelect(product.id)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="hover:underline text-blue-600"
                  >
                    {product.name}
                  </Link>
                  {!product.isActive && (
                    <Badge variant="outline" className="ml-2 text-xs">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                <TableCell>{product.category.name}</TableCell>
                <TableCell className="text-right">
                  <span className={
                    product.inventory === 0
                      ? 'text-destructive font-bold'
                      : product.inventory <= product.lowStockThreshold
                      ? 'text-yellow-600 font-semibold'
                      : 'font-medium'
                  }>
                    {product.inventory}
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{product.lowStockThreshold}</TableCell>
                <TableCell>{getStockBadge(product)}</TableCell>
                <TableCell className="text-right">${Number(product.price).toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium">${getInventoryValue(product)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/inventory/${product.id}`}>
                        <History className="h-4 w-4" />
                      </Link>
                    </Button>
                    {canWrite && (
                      <InventoryAdjustmentDialog productId={product.id} productName={product.name} />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
