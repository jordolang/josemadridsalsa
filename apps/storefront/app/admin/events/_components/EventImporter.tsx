'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Fields the importer understands, in the order they're shown. */
const MAPPABLE_FIELDS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: 'title', label: 'Event name', required: true },
  { key: 'startDate', label: 'Start date', required: true },
  { key: 'endDate', label: 'End date' },
  { key: 'applicationDeadline', label: 'Application deadline' },
  { key: 'location', label: 'Location' },
  { key: 'boothFee', label: 'Booth fee' },
  { key: 'externalId', label: 'FestivalNet ID' },
  { key: 'description', label: 'Description' },
  { key: 'contactName', label: 'Contact name' },
  { key: 'contactEmail', label: 'Contact email' },
  { key: 'contactPhone', label: 'Contact phone' },
]

const STATUS_OPTIONS = [
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'WAITLISTED', label: 'Waitlisted' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'CONFIRMED', label: 'Confirmed' },
]

const NONE = '__none__'

interface PreviewRow {
  rowNumber: number
  title: string
  location: string | null
  startDate: string | null
  applicationDeadline: string | null
  boothFee: number | null
  action: 'create' | 'update' | 'error'
  reason: string | null
  matchedId: string | null
}

interface PreviewResult {
  headers: string[]
  mapping: Record<string, string | undefined>
  missingRequired: string[]
  rows: PreviewRow[]
  summary: { create: number; update: number; error: number }
  committed: boolean
  created?: number
  updated?: number
  failures?: Array<{ rowNumber: number; message: string }>
}

export default function EventImporter() {
  const router = useRouter()
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Record<string, string | undefined>>({})
  const [defaultStatus, setDefaultStatus] = useState('INTERESTED')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File) {
    const text = await file.text()
    setCsv(text)
    setFileName(file.name)
    setPreview(null)
    setMapping({})
  }

  async function run(commit: boolean) {
    if (!csv.trim()) {
      toast.error('Add a CSV file or paste its contents first')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/admin/events/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv,
          commit,
          defaultStatus,
          // Only send overrides the user actually set.
          mapping: Object.fromEntries(
            Object.entries(mapping).filter(([, v]) => v && v !== NONE)
          ),
        }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(payload?.error || 'Import failed')
        return
      }

      const data = payload as PreviewResult
      setPreview(data)
      setMapping(data.mapping ?? {})

      if (data.missingRequired?.length) {
        toast.error(
          `Could not find a column for: ${data.missingRequired.join(', ')}. Map them below.`
        )
      } else if (commit) {
        toast.success(`Imported — ${data.created ?? 0} added, ${data.updated ?? 0} updated`)
        router.refresh()
      }
    } catch (error) {
      console.error('Import failed:', error)
      toast.error('Import failed')
    } finally {
      setBusy(false)
    }
  }

  const canCommit =
    preview && !preview.committed && preview.missingRequired.length === 0 &&
    preview.summary.create + preview.summary.update > 0

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">1. Add the export</h2>
          <p className="text-sm text-muted-foreground">
            In FestivalNet, choose <em>Export My List</em>. Their export always contains your
            whole list, so re-importing is safe — matching shows update in place instead of
            duplicating.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Label
            htmlFor="csv-file"
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            <FileUp className="h-4 w-4" />
            Choose CSV file
          </Label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="csv-text">Or paste the CSV contents</Label>
          <Textarea
            id="csv-text"
            rows={5}
            value={csv}
            placeholder="Event Name,City,Start Date,Application Deadline,Booth Fee"
            onChange={(e) => {
              setCsv(e.target.value)
              setPreview(null)
            }}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="defaultStatus">Status for newly added shows</Label>
            <Select value={defaultStatus} onValueChange={setDefaultStatus}>
              <SelectTrigger id="defaultStatus" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => run(false)} disabled={busy || !csv.trim()} variant="outline">
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Preview
          </Button>
        </div>
      </Card>

      {preview && (
        <>
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">2. Check the column mapping</h2>
              <p className="text-sm text-muted-foreground">
                Detected automatically from your headers. Override anything that looks wrong,
                then preview again.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MAPPABLE_FIELDS.map((field) => {
                const missing = preview.missingRequired.includes(field.key)
                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label className={missing ? 'text-destructive' : undefined}>
                      {field.label}
                      {field.required && ' *'}
                    </Label>
                    <Select
                      value={mapping[field.key] ?? NONE}
                      onValueChange={(v) =>
                        setMapping((m) => ({ ...m, [field.key]: v === NONE ? undefined : v }))
                      }
                    >
                      <SelectTrigger className={missing ? 'border-destructive' : undefined}>
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not mapped</SelectItem>
                        {preview.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>

            <Button onClick={() => run(false)} disabled={busy} variant="outline" size="sm">
              Re-run preview
            </Button>
          </Card>

          {preview.rows.length > 0 && (
            <Card className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">3. Review and import</h2>
                  <div className="mt-1 flex flex-wrap gap-2 text-sm">
                    <Badge className="bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-300">
                      {preview.summary.create} new
                    </Badge>
                    <Badge className="bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300">
                      {preview.summary.update} to update
                    </Badge>
                    {preview.summary.error > 0 && (
                      <Badge className="bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300">
                        {preview.summary.error} skipped
                      </Badge>
                    )}
                  </div>
                </div>

                {preview.committed ? (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Imported
                  </span>
                ) : (
                  <Button onClick={() => run(true)} disabled={busy || !canCommit}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import {preview.summary.create + preview.summary.update} shows
                  </Button>
                )}
              </div>

              {preview.failures && preview.failures.length > 0 && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
                  <p className="mb-1 font-medium text-destructive">
                    {preview.failures.length} row(s) failed to save
                  </p>
                  <ul className="list-inside list-disc text-muted-foreground">
                    {preview.failures.map((f) => (
                      <li key={f.rowNumber}>
                        Row {f.rowNumber}: {f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Row</th>
                      <th className="py-2 pr-3 font-medium">Action</th>
                      <th className="py-2 pr-3 font-medium">Event</th>
                      <th className="py-2 pr-3 font-medium">Start</th>
                      <th className="py-2 pr-3 font-medium">Deadline</th>
                      <th className="py-2 pr-3 font-medium">Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-muted-foreground">{row.rowNumber}</td>
                        <td className="py-2 pr-3">
                          <RowActionBadge row={row} />
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-medium">{row.title || '—'}</div>
                          {row.location && (
                            <div className="text-xs text-muted-foreground">{row.location}</div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {row.startDate ? format(new Date(row.startDate), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {row.applicationDeadline
                            ? format(new Date(row.applicationDeadline), 'MMM d, yyyy')
                            : '—'}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {row.boothFee === null ? '—' : `$${row.boothFee.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function RowActionBadge({ row }: { row: PreviewRow }) {
  if (row.action === 'error') {
    return (
      <span
        className="flex items-center gap-1 text-xs text-destructive"
        title={row.reason ?? undefined}
      >
        <AlertTriangle className="h-3 w-3" />
        Skipped
      </span>
    )
  }
  if (row.action === 'update') {
    return (
      <Badge
        className="bg-blue-100 text-xs text-blue-900 dark:bg-blue-950 dark:text-blue-300"
        title={row.reason ?? undefined}
      >
        Update
      </Badge>
    )
  }
  return (
    <Badge className="bg-green-100 text-xs text-green-900 dark:bg-green-950 dark:text-green-300">
      New
    </Badge>
  )
}
