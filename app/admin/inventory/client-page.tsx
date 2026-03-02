'use client';

import { InventoryExportDialog } from '@/components/admin/inventory/InventoryExportDialog';
import { InventoryImportDialog } from '@/components/admin/inventory/InventoryImportDialog';

interface InventoryClientActionsProps {
  canImport: boolean;
  canExport: boolean;
}

export function InventoryClientActions({ canImport, canExport }: InventoryClientActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {canImport && <InventoryImportDialog />}
      {canExport && <InventoryExportDialog />}
    </div>
  );
}
