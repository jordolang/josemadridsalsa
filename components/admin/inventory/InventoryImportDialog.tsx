'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export function InventoryImportDialog() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({ title: 'Invalid file', description: 'Please upload a CSV file', variant: 'destructive' });
      return;
    }

    setFile(selectedFile);

    // Parse preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      const rows = lines.slice(0, 6).map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
      setPreview(rows);
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/inventory/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Import failed');
      }

      toast({
        title: 'Import complete',
        description: `Updated ${data.data.successCount} of ${data.data.totalCount} products`,
      });

      setOpen(false);
      setFile(null);
      setPreview([]);
      router.refresh();
    } catch (error: any) {
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Inventory Data</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: SKU, Quantity, Type (RESTOCK/ADJUSTMENT), Notes (optional).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              {file ? file.name : 'Choose CSV File'}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Expected format: SKU, Quantity, Type, Notes
            </p>
          </div>

          {preview.length > 0 && (
            <div className="rounded-md border overflow-auto max-h-48">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {preview[0].map((header, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, i) => (
                    <tr key={i} className="border-t">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-1.5">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 5 && (
                <p className="text-xs text-muted-foreground p-2 text-center">
                  Showing first 5 rows...
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); setFile(null); setPreview([]); }} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || loading}>
            {loading ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
