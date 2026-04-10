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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface CsvImportModalProps {
  listId: string
  listName: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

type Step = 'upload' | 'mapping' | 'result'

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

const TARGET_FIELDS = [
  { value: 'email', label: 'Email Address *', required: true },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'phone', label: 'Phone Number' },
  { value: '__ignore__', label: '— Skip this column —' },
]

export function CsvImportModal({ listId, listName, open, onClose, onSuccess }: CsvImportModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError(null)
    setLoading(true)

    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch(`/api/admin/mailing-lists/${listId}/import`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json() as {
        headers?: string[]
        preview?: Record<string, string>[]
        totalRows?: number
        error?: string
      }
      if (!res.ok) {
        setError(data.error || 'Failed to parse CSV')
        setLoading(false)
        return
      }
      setHeaders(data.headers ?? [])
      setPreview(data.preview ?? [])
      setTotalRows(data.totalRows ?? 0)

      // Auto-detect mapping
      const autoMapping: Record<string, string> = {}
      for (const h of (data.headers ?? [])) {
        const lh = h.toLowerCase().replace(/[\s_-]/g, '')
        if (lh === 'email' || lh === 'emailaddress' || lh === 'e-mail') autoMapping[h] = 'email'
        else if (lh === 'firstname' || lh === 'first') autoMapping[h] = 'firstName'
        else if (lh === 'lastname' || lh === 'last') autoMapping[h] = 'lastName'
        else if (lh === 'phone' || lh === 'phonenumber' || lh === 'mobile') autoMapping[h] = 'phone'
      }
      setMapping(autoMapping)
      setStep('mapping')
    } catch {
      setError('Failed to parse CSV file')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file) return
    const emailCol = Object.entries(mapping).find(([, v]) => v === 'email')?.[0]
    if (!emailCol) {
      setError('Please map the Email column')
      return
    }

    setLoading(true)
    setError(null)

    // Build reverse mapping (fieldName -> csvHeader)
    const reverseMapping: Record<string, string> = {}
    for (const [header, field] of Object.entries(mapping)) {
      if (field && field !== '__ignore__') {
        reverseMapping[field] = header
      }
    }

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mapping', JSON.stringify(reverseMapping))
      const res = await fetch(`/api/admin/mailing-lists/${listId}/import`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json() as { result?: ImportResult; error?: string }
      if (!res.ok) {
        setError(data.error || 'Import failed')
        setLoading(false)
        return
      }
      setResult(data.result ?? null)
      setStep('result')
    } catch {
      setError('Import failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    const didImport = result !== null && result.imported > 0
    setStep('upload')
    setFile(null)
    setHeaders([])
    setPreview([])
    setMapping({})
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
    onClose()
    if (didImport) onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Subscribers from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import subscribers into "{listName}"
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-input rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">CSV files up to 5MB</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Parsing CSV...
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Tip: Export your mailing list as CSV and upload it here. Duplicate emails will
              be updated, not duplicated.
            </p>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map your CSV columns to subscriber fields.{' '}
              <strong>{totalRows} rows</strong> found.
            </p>
            <div className="space-y-3">
              {headers.map((header) => (
                <div key={header} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium truncate">{header}</Label>
                    {preview[0]?.[header] && (
                      <p className="text-xs text-muted-foreground truncate">
                        e.g. {preview[0][header]}
                      </p>
                    )}
                  </div>
                  <Select
                    value={mapping[header] || '__ignore__'}
                    onValueChange={(val) => setMapping((m) => ({ ...m, [header]: val }))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  `Import ${totalRows} Subscribers`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800">Import Complete</p>
                <p className="text-sm text-green-700">
                  {result.imported} imported · {result.skipped} skipped
                </p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                  Errors ({result.errors.length}):
                </p>
                <div className="max-h-32 overflow-y-auto text-xs text-destructive bg-destructive/10 rounded p-2 space-y-1">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                  {result.errors.length > 20 && (
                    <p>...and {result.errors.length - 20} more</p>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
