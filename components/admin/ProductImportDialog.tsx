'use client';

import { useState } from 'react';
import { Upload, X, FileJson, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// File size limit in bytes (10 MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface ImportResult {
  success: boolean;
  message?: string;
  errors?: string[];
  validationErrors?: Array<{ row: number; errors: string[] }>;
  imported?: number;
  skipped?: number;
  totalRows?: number;
}

export function ProductImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ProductImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'json' | 'csv' | 'excel'>('json');
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file size
      if (selectedFile.size > MAX_FILE_SIZE) {
        setResult({
          success: false,
          errors: [
            `File size exceeds the maximum limit of ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB. ` +
            `Selected file is ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB.`
          ],
        });
        return;
      }

      setFile(selectedFile);
      setResult(null);

      // Auto-detect file type
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (extension === 'json') {
        setFileType('json');
      } else if (extension === 'csv') {
        setFileType('csv');
      } else if (['xlsx', 'xls'].includes(extension || '')) {
        setFileType('excel');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', fileType);
      formData.append('skipDuplicates', String(skipDuplicates));

      const response = await fetch('/api/admin/products/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        // Wait a moment to show success message
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (error: any) {
      setResult({
        success: false,
        errors: [error.message || 'An error occurred during upload'],
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setSkipDuplicates(false);
    onOpenChange(false);
  };

  const getFileIcon = () => {
    switch (fileType) {
      case 'json':
        return <FileJson className="h-5 w-5 text-blue-500" />;
      case 'csv':
      case 'excel':
        return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
      default:
        return <Upload className="h-5 w-5" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
          <DialogDescription>
            Upload a product catalog in JSON, CSV, or Excel format to bulk import products.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">Select File</Label>
            <div className="flex items-center gap-3">
              <label
                htmlFor="file"
                className="flex flex-1 items-center justify-center gap-2 rounded-md border-2 border-dashed border-input bg-muted/50 px-6 py-8 text-sm transition-colors hover:border-muted-foreground hover:bg-muted cursor-pointer"
              >
                {file ? (
                  <>
                    {getFileIcon()}
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Click to upload or drag and drop
                    </span>
                  </>
                )}
              </label>
              <input
                id="file"
                type="file"
                accept=".json,.csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
              />
              {file && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setResult(null);
                  }}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Supported formats: JSON (.json), CSV (.csv), Excel (.xlsx, .xls). Max size: 10MB
            </p>
          </div>

          {/* File Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="fileType">File Type</Label>
            <Select
              value={fileType}
              onValueChange={(value: any) => setFileType(value)}
              disabled={isUploading}
            >
              <SelectTrigger id="fileType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="excel">Excel (XLSX/XLS)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Skip Duplicates Option */}
          <div className="flex items-center gap-2">
            <input
              id="skipDuplicates"
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              disabled={isUploading}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="skipDuplicates" className="text-sm font-normal cursor-pointer">
              Skip products with duplicate SKUs (import only new products)
            </Label>
          </div>

          {/* Format Information */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Required fields:</strong> name, slug, sku, price, heatLevel (MILD/MEDIUM/HOT/EXTRA_HOT/FRUIT),
              categoryId or categoryName
              <br />
              <strong>Optional fields:</strong> description, compareAtPrice, costPrice, inventory,
              lowStockThreshold, ingredients (comma-separated), barcode, weight, featuredImage,
              images (comma-separated URLs), isActive, isFeatured, sortOrder, metaTitle,
              metaDescription, ogImage, searchKeywords (comma-separated)
            </AlertDescription>
          </Alert>

          {/* Result Messages */}
          {result && (
            <Alert className={result.success ? 'border-green-500 bg-green-50' : 'border-destructive bg-destructive/10'}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <AlertDescription>
                {result.success ? (
                  <div>
                    <p className="font-medium text-green-900">{result.message}</p>
                    {result.imported !== undefined && (
                      <p className="text-sm text-green-700 mt-1">
                        Imported: {result.imported} products
                        {result.skipped ? ` | Skipped: ${result.skipped}` : ''}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {result.errors?.map((error, index) => (
                      <p key={index} className="text-sm text-destructive">
                        {error}
                      </p>
                    ))}
                    {result.validationErrors && result.validationErrors.length > 0 && (
                      <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                        <p className="font-medium text-destructive">Validation errors:</p>
                        {result.validationErrors.slice(0, 10).map((err, index) => (
                          <div key={index} className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                            <strong>Row {err.row}:</strong>
                            <ul className="list-disc list-inside mt-1">
                              {err.errors.map((e, i) => (
                                <li key={i}>{e}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        {result.validationErrors.length > 10 && (
                          <p className="text-xs text-destructive">
                            ... and {result.validationErrors.length - 10} more errors
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!file || isUploading}
            >
              {isUploading ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Products
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
