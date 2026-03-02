'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductImportDialog } from './ProductImportDialog';
import { useRouter } from 'next/navigation';

export function ProductImportButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    // Refresh the page to show newly imported products
    router.refresh();
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Import
      </Button>
      <ProductImportDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
