'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function ImportOrdersDialog() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const handleImport = async () => {
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('skipDuplicates', 'true')
      formData.append('createMissingUsers', 'false')

      const res = await fetch('/api/admin/orders/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setResult(data)
      toast({
        title: 'Import Complete',
        description: `Successfully imported ${data.successCount} orders. ${data.errorCount} errors.`,
      })
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: String(error),
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Import Orders
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Orders</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!result && (
            <>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                    Select File
                  </Button>
                </label>
                {file && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Selected: {file.name}
                  </p>
                )}
              </div>

              <Button
                onClick={handleImport}
                disabled={!file || uploading}
                className="w-full"
              >
                {uploading ? 'Importing...' : 'Import Orders'}
              </Button>
            </>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Import Summary</p>
                  <p className="text-sm text-muted-foreground">
                    {result.successCount} orders imported successfully
                  </p>
                </div>
              </div>

              {result.errorCount > 0 && (
                <div className="flex items-start gap-2 p-4 bg-red-50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900">{result.errorCount} errors</p>
                    <div className="mt-2 space-y-1 text-sm text-red-800">
                      {result.errors.slice(0, 5).map((err: any, i: number) => (
                        <p key={i}>Row {err.row}: {err.message}</p>
                      ))}
                      {result.errors.length > 5 && (
                        <p className="text-xs">...and {result.errors.length - 5} more</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={() => {
                setResult(null)
                setFile(null)
                setOpen(false)
              }} className="w-full">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
