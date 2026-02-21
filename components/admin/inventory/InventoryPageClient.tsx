'use client';

import { useState } from 'react';
import { InventoryTable } from './InventoryTable';
import { BulkAdjustmentDialog } from './BulkAdjustmentDialog';

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

interface InventoryPageClientProps {
  products: Product[];
  canWrite: boolean;
}

export function InventoryPageClient({ products, canWrite }: InventoryPageClientProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      {canWrite && selectedIds.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">
            {selectedIds.length} product(s) selected
          </span>
          <BulkAdjustmentDialog
            selectedProductIds={selectedIds}
            onComplete={() => setSelectedIds([])}
          />
        </div>
      )}

      <InventoryTable
        products={products}
        canWrite={canWrite}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
    </div>
  );
}
