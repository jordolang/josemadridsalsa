'use client';

import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export function InventoryImportDialog() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<'csv' | 'excel'>('csv');
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (format === 'csv' && extension !== 'csv') {
        toast({
          title: 'Invalid file type',
          description: 'Please select a CSV file',
          variant: 'destructive',
        });
        setFile(null);
        e.currentTarget.value = '';
        return;
      }
      if (format === 'excel' && !['xlsx', 'xls'].includes(extension || '')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an Excel file (.xlsx or .xls)',
          variant: 'destructive',
        });
        setFile(null);
        e.currentTarget.value = '';
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to import',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', format);

      const response = await fetch('/api/admin/inventory/import', {
        method: 'POST',
        body: formData,
      });

      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new Error('Unexpected server response — could not parse JSON');
      }

      if (!response.ok || data.success === false || data.errors?.length || data.failed) {
        const detail = data.errors?.[0] || data.message || 'Failed to import inventory';
        throw new Error(detail);
      }

      toast({
        title: 'Import successful',
        description: data.message || `Successfully imported ${data.updated || 0} product(s)`,
      });

      setOpen(false);
      setFile(null);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import Inventory
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import Inventory</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to update inventory levels
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleImport}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="format">File Format</Label>
              <Select
                value={format}
                onValueChange={(value) => {
                  setFormat(value as 'csv' | 'excel');
                  setFile(null); // Clear file when format changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Comma-separated values)</SelectItem>
                  <SelectItem value="excel">Excel (XLSX)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {format === 'csv'
                  ? 'Upload a CSV file with SKU and quantity columns'
                  : 'Upload an Excel file (.xlsx) with SKU and quantity columns'}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="file">File Upload</Label>
              <Input
                id="file"
                type="file"
                accept={format === 'csv' ? '.csv' : '.xlsx,.xls'}
                onChange={handleFileChange}
                required
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setFile(null);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !file}>
              {loading ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
