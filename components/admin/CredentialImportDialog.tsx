'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ImportResult {
  totalRows: number
  successCount: number
  errorCount: number
  results: { row: number; status: 'success' | 'error'; error?: string }[]
}

interface CredentialImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export default function CredentialImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: CredentialImportDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFileSelect = (selectedFile: File) => {
    const name = selectedFile.name.toLowerCase()
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a .csv or .xlsx file',
        variant: 'destructive',
      })
      return
    }
    setFile(selectedFile)
    setResult(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) handleFileSelect(droppedFile)
  }

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/credentials/import', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setResult(data)

      if (data.successCount > 0) {
        toast({
          title: 'Import Complete',
          description: `${data.successCount} credentials imported successfully${data.errorCount > 0 ? `, ${data.errorCount} failed` : ''}`,
        })
        onSuccess()
      }
    } catch (err: any) {
      toast({ title: 'Import Failed', description: err.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Credentials
          </DialogTitle>
          <DialogDescription>
            Upload a .csv or .xlsx file to bulk-import credentials. Expected columns: Provider, Label,
            Username/Email, Password, URL, Notes.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* Drop Zone */}
            <div
              className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragOver
                  ? 'border-blue-400 bg-blue-50'
                  : file
                    ? 'border-green-300 bg-green-50'
                    : 'border-slate-300 hover:border-slate-400'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFileSelect(f)
                }}
              />
              <Upload className="mx-auto mb-3 h-8 w-8 text-slate-400" />
              {file ? (
                <div>
                  <p className="font-medium text-green-700">{file.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB - Click or drop to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-slate-700">
                    Drop your file here or click to browse
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Supports .csv and .xlsx files
                  </p>
                </div>
              )}
            </div>

            {/* Column Info */}
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-600">Expected Columns:</p>
              <p className="mt-1 text-xs text-slate-500">
                Provider (or Service Name), Label, Username (or Email), Password, URL, Notes
              </p>
            </div>
          </div>
        ) : (
          /* Results */
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-2xl font-bold">{result.totalRows}</p>
                <p className="text-xs text-slate-500">Total Rows</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{result.successCount}</p>
                <p className="text-xs text-green-600">Imported</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{result.errorCount}</p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
            </div>

            {result.errorCount > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium text-red-700">Errors:</p>
                {result.results
                  .filter((r) => r.status === 'error')
                  .map((r) => (
                    <div key={r.row} className="flex items-start gap-2 text-sm">
                      <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                      <span>
                        Row {r.row}: {r.error}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleUpload} disabled={!file || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
