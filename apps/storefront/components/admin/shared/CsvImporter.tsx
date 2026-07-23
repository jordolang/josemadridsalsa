'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
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

/**
 * Generic CSV importer, factored out of the Events importer so Customers,
 * Fundraisers, and future entities share one preview → map → commit flow.
 *
 * The import route must default to a dry run and only write when `commit` is
 * true, returning the `PreviewResult` contract below. Nothing is imported until
 * the user reviews the preview and clicks commit.
 */

export interface ImporterField {
  key: string
  label: string
  required?: boolean
}

export interface ImporterColumn {
  key: string
  label: string
}

const NONE = '__none__'

interface PreviewRow {
  rowNumber: number
  action: 'create' | 'update' | 'error'
  reason: string | null
  cells: Record<string, string | null>
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

interface CsvImporterProps {
  /** Import route, e.g. `/api/admin/customers/import`. */
  endpoint: string
  /** Plural noun used in button/labels, e.g. "customers". */
  entityLabel: string
  /** Fields shown in the column-mapping grid. */
  targetFields: ImporterField[]
  /** Columns shown in the preview table (keyed to each row's `cells`). */
  previewColumns: ImporterColumn[]
  instructions?: ReactNode
  samplePlaceholder?: string
}

export function CsvImporter({
  endpoint,
  entityLabel,
  targetFields,
  previewColumns,
  instructions,
  samplePlaceholder,
}: CsvImporterProps) {
  const router = useRouter()
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Record<string, string | undefined>>({})
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [rejection, setRejection] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File) {
    const text = await file.text()
    setCsv(text)
    setFileName(file.name)
    setPreview(null)
    setRejection(null)
    setMapping({})
  }

  async function run(commit: boolean) {
    if (!csv.trim()) {
      toast.error('Add a CSV file or paste its contents first')
      return
    }

    setBusy(true)
    setRejection(null)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv,
          commit,
          mapping: Object.fromEntries(
            Object.entries(mapping).filter(([, v]) => v && v !== NONE)
          ),
        }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setPreview(null)
        setRejection(payload?.error || 'Import failed')
        toast.error('The file was rejected — nothing was imported')
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
        toast.success(
          `Imported — ${data.created ?? 0} added, ${data.updated ?? 0} updated`
        )
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
    preview &&
    !preview.committed &&
    preview.missingRequired.length === 0 &&
    preview.summary.create + preview.summary.update > 0

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">1. Add the CSV</h2>
          {instructions && (
            <div className="mt-1 text-sm text-muted-foreground">{instructions}</div>
          )}
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
          {fileName && (
            <span className="text-sm text-muted-foreground">{fileName}</span>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="csv-text">Or paste the CSV contents</Label>
          <Textarea
            id="csv-text"
            rows={5}
            value={csv}
            placeholder={samplePlaceholder}
            onChange={(e) => {
              setCsv(e.target.value)
              setPreview(null)
            }}
            className="font-mono text-xs"
          />
        </div>

        <Button
          onClick={() => run(false)}
          disabled={busy || !csv.trim()}
          variant="outline"
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Preview
        </Button>
      </Card>

      {rejection && (
        <Card className="border-destructive/50 bg-destructive/5 p-6">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="font-medium text-destructive">
                File rejected — nothing was imported
              </p>
              <pre className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                {rejection}
              </pre>
              <p className="text-sm text-muted-foreground">
                Fix the file and try again — no partial rows were written.
              </p>
            </div>
          </div>
        </Card>
      )}

      {preview && (
        <>
          <Card className="space-y-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">2. Check the column mapping</h2>
              <p className="text-sm text-muted-foreground">
                Detected automatically from your headers. Override anything that
                looks wrong, then preview again.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {targetFields.map((field) => {
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
                        setMapping((m) => ({
                          ...m,
                          [field.key]: v === NONE ? undefined : v,
                        }))
                      }
                    >
                      <SelectTrigger
                        className={missing ? 'border-destructive' : undefined}
                      >
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

            <Button
              onClick={() => run(false)}
              disabled={busy}
              variant="outline"
              size="sm"
            >
              Re-run preview
            </Button>
          </Card>

          {preview.rows.length > 0 && (
            <Card className="space-y-4 p-6">
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
                    Import {preview.summary.create + preview.summary.update}{' '}
                    {entityLabel}
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
                      {previewColumns.map((col) => (
                        <th key={col.key} className="py-2 pr-3 font-medium">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-muted-foreground">
                          {row.rowNumber}
                        </td>
                        <td className="py-2 pr-3">
                          <RowActionBadge row={row} />
                        </td>
                        {previewColumns.map((col) => (
                          <td key={col.key} className="py-2 pr-3 text-muted-foreground">
                            {row.cells[col.key] || '—'}
                          </td>
                        ))}
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
