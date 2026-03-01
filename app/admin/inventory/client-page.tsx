'use client';

import { InventoryExportDialog } from '@/components/admin/inventory/InventoryExportDialog';
import { InventoryImportDialog } from '@/components/admin/inventory/InventoryImportDialog';

export function InventoryClientActions() {
  return (
    <div className="flex items-center gap-2">
      <InventoryImportDialog />
      <InventoryExportDialog />
    </div>
  );
}
