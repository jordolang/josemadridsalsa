'use client'

import { useState, useRef } from 'react'
import { MailingList } from '@prisma/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Upload, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react'

interface ConstantContactImportModalProps {
  lists: { id: string; name: string }[]
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

type Step = 'upload' | 'confirm' | 'result'

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

interface ParsedPreview {
  headers: string[]
  preview: Record<string, string>[]
  totalRows: number
}

const EXPECTED_HEADERS = [
  'Email address',
  'First name',
  'Last name',
  'Email status',
  'Email permission status',
  'Source Name',
  'Created At',
]

const CC_FIELD_MAPPING: Record<string, string> = {
  email: 'Email address',
  firstName: 'First name',
  lastName: 'Last name',
  status: 'Email status',
  source: 'Source Name',
}

const CC_STATUS_MAPPING: Record<string, string> = {
  Active: 'SUBSCRIBED',
  Unsubscribed: 'UNSUBSCRIBED',
  Bounced: 'BOUNCED',
  'Non-Subscribed': 'UNSUBSCRIBED',
  Removed: 'UNSUBSCRIBED',
}

function validateConstantContactHeaders(headers: string[]): { valid: boolean; missing: string[] } {
  const required = ['Email address', 'Email status']
  const missing = required.filter((h) => !headers.includes(h))
  return { valid: missing.length === 0, missing }
}

export function ConstantContactImportModal({
  lists,
  open,
  onClose,
  onSuccess,
}: ConstantContactImportModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [parsedData, setParsedData] = useState<ParsedPreview | null>(null)
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

    if (!selectedListId) {
      setError('Please select a mailing list first')
      setLoading(false)
      return
    }

    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch(`/api/admin/mailing-lists/${selectedListId}/import`, {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json()) as {
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

      const headers = data.headers ?? []
      const validation = validateConstantContactHeaders(headers)
      if (!validation.valid) {
        setError(
          `This doesn't appear to be a Constant Contact export. Missing required columns: ${validation.missing.join(', ')}`
        )
        setLoading(false)
        return
      }

      setParsedData({
        headers,
        preview: data.preview ?? [],
        totalRows: data.totalRows ?? 0,
      })
      setStep('confirm')
    } catch {
      setError('Failed to parse CSV file')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file || !selectedListId) return
    setLoading(true)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mapping', JSON.stringify(CC_FIELD_MAPPING))
      fd.append('statusMapping', JSON.stringify(CC_STATUS_MAPPING))

      const res = await fetch(`/api/admin/mailing-lists/${selectedListId}/import`, {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json()) as { result?: ImportResult; error?: string }
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
    setSelectedListId('')
    setParsedData(null)
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
    onClose()
    if (didImport) onSuccess()
  }

  const selectedListName = lists.find((l) => l.id === selectedListId)?.name

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import from Constant Contact
          </DialogTitle>
          <DialogDescription>
            Upload a CSV exported from Constant Contact. Contacts will be automatically mapped and
            imported into the selected mailing list.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="target-list">Target Mailing List</Label>
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger id="target-list">
                  <SelectValue placeholder="Select a mailing list..." />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                selectedListId
                  ? 'border-gray-300 cursor-pointer hover:border-blue-400'
                  : 'border-gray-200 cursor-not-allowed opacity-60'
              }`}
              onClick={() => selectedListId && fileRef.current?.click()}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-sm font-medium">
                {selectedListId ? 'Click to upload Constant Contact CSV' : 'Select a list first'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">CSV files up to 5MB</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileSelect}
                disabled={!selectedListId}
              />
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Parsing CSV...
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Expected Constant Contact CSV format:</p>
              <p className="font-mono text-[10px]">
                {EXPECTED_HEADERS.join(', ')}
              </p>
              <p>
                "Active" contacts will be imported as subscribed. "Unsubscribed" contacts will be
                preserved as unsubscribed. Duplicate emails are updated, not duplicated.
              </p>
            </div>
          </div>
        )}

        {step === 'confirm' && parsedData && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">Import Summary</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Target list:</span>
                <span className="font-medium">{selectedListName}</span>
                <span className="text-muted-foreground">Total contacts:</span>
                <span className="font-medium">{parsedData.totalRows}</span>
                <span className="text-muted-foreground">Detected columns:</span>
                <span className="font-medium">{parsedData.headers.length}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Column Mapping (auto-detected)</p>
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                {Object.entries(CC_FIELD_MAPPING).map(([field, header]) => (
                  <div key={field} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{header}</span>
                    <span className="font-mono text-xs">
                      {parsedData.headers.includes(header) ? (
                        <span className="text-green-600">&#10003; {field}</span>
                      ) : (
                        <span className="text-amber-600">-- not found</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {parsedData.preview.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Preview (first {parsedData.preview.length} rows)</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-left">Email</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.preview.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{row['Email address'] || '-'}</td>
                          <td className="p-2">
                            {[row['First name'], row['Last name']].filter(Boolean).join(' ') || '-'}
                          </td>
                          <td className="p-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                row['Email status'] === 'Active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {row['Email status']}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setStep('upload'); setFile(null); setParsedData(null); }}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  `Import ${parsedData.totalRows} Contacts`
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
                {selectedListName && (
                  <p className="text-xs text-green-600 mt-1">
                    Imported into &ldquo;{selectedListName}&rdquo;
                  </p>
                )}
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-600">
                  Errors ({result.errors.length}):
                </p>
                <div className="max-h-32 overflow-y-auto text-xs text-red-500 bg-red-50 rounded p-2 space-y-1">
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
