'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPrice } from '@/lib/utils'
import {
  CATEGORY_DIRECTION,
  LEDGER_CATEGORY_LABELS,
  LEDGER_CATEGORY_VALUES,
} from '@/lib/financials/ledger'

type Category = (typeof LEDGER_CATEGORY_VALUES)[number]

interface ReviewRow {
  lineNumber: number
  date: string
  description: string
  amountCents: number
  contentHash: string
  suggestedCategory: Category
  excludedReason: 'ledger-match' | 'processor-payout' | null
  excludedNote: string | null
  alreadyImported: boolean
}

interface PreviewResponse {
  headers: string[]
  mapping: Record<string, string | undefined>
  problems: string[]
  needsMapping: boolean
  rows: ReviewRow[]
  errors: Array<{ lineNumber: number; reason: string }>
  summary?: {
    parsed: number
    excluded: number
    alreadyImported: number
    unreadable: number
  }
}

/** Local per-row decisions layered over what the preview proposed. */
interface RowChoice {
  include: boolean
  category: Category
}

const MAPPING_FIELDS = [
  { field: 'date', label: 'Date' },
  { field: 'description', label: 'Description' },
  { field: 'amount', label: 'Amount (signed)' },
  { field: 'debit', label: 'Debit / money out' },
  { field: 'credit', label: 'Credit / money in' },
] as const

export default function StatementImportClient() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [csv, setCsv] = useState('')
  const [filename, setFilename] = useState('')
  const [accountLabel, setAccountLabel] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [choices, setChoices] = useState<Record<string, RowChoice>>({})
  const [busy, setBusy] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    setFilename(file.name)
    setCsv(await file.text())
    setPreview(null)
    setChoices({})
  }

  async function runPreview(withMapping?: Record<string, string>) {
    if (!csv) {
      toast.error('Choose a statement file first')
      return
    }
    if (!accountLabel.trim()) {
      toast.error('Name the account this statement came from')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/admin/financials/ledger/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, accountLabel, mapping: withMapping ?? mapping }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Could not read that file')

      const data: PreviewResponse = body
      setPreview(data)
      setMapping(Object.fromEntries(Object.entries(data.mapping).filter(([, v]) => v)) as Record<string, string>)

      // A row the preview excluded starts unticked. The tool holds an opinion; the bookkeeper
      // overrides it row by row rather than having to remember to untick anything.
      setChoices(
        Object.fromEntries(
          data.rows.map((r) => [
            r.contentHash,
            { include: r.excludedReason === null && !r.alreadyImported, category: r.suggestedCategory },
          ])
        )
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read that file')
    } finally {
      setBusy(false)
    }
  }

  const included = useMemo(
    () => (preview?.rows ?? []).filter((r) => choices[r.contentHash]?.include),
    [preview, choices]
  )

  /** A category on the wrong side would flip a sign in every report; the server refuses it too. */
  const misfiled = useMemo(
    () =>
      included.filter((r) => {
        const category = choices[r.contentHash].category
        const wanted = r.amountCents >= 0 ? 'INCOME' : 'EXPENSE'
        return CATEGORY_DIRECTION[category] !== wanted
      }),
    [included, choices]
  )

  async function commit() {
    if (included.length === 0) {
      toast.error('Nothing selected to import')
      return
    }
    if (misfiled.length > 0) {
      toast.error(`${misfiled.length} row(s) have a category on the wrong side of the ledger`)
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/admin/financials/ledger/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          accountLabel,
          skipped: (preview?.rows.length ?? 0) - included.length,
          rows: included.map((r) => ({
            date: r.date.slice(0, 10),
            description: r.description,
            amountCents: r.amountCents,
            category: choices[r.contentHash].category,
          })),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Import failed')

      const imported = body.imported ?? included.length
      toast.success(`Imported ${imported} row(s) into the ledger`)
      router.push('/admin/financials/ledger')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  function setChoice(hash: string, patch: Partial<RowChoice>) {
    setChoices((prev) => ({ ...prev, [hash]: { ...prev[hash], ...patch } }))
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="statement-file">Statement file (CSV)</Label>
            <Input
              id="statement-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {filename && <p className="text-xs text-muted-foreground">{filename}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-label">Account</Label>
            <Input
              id="account-label"
              placeholder="e.g. Chase business checking"
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Recorded on each row, and part of how a repeated line is recognised — the same amount
              on the same day is a different transaction on a different account.
            </p>
          </div>
        </div>

        <Button onClick={() => runPreview()} disabled={busy || !csv}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Read the file
        </Button>
      </Card>

      {preview?.needsMapping && (
        <Card className="space-y-4 p-6 border-amber-500/50">
          <div>
            <h2 className="font-semibold">Which column is which?</h2>
            <p className="text-sm text-muted-foreground">
              {preview.problems.join(' · ')}. Pick the columns, then read the file again.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MAPPING_FIELDS.map(({ field, label }) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Select
                  value={mapping[field] ?? '__none__'}
                  onValueChange={(v) =>
                    setMapping((prev) => {
                      const next = { ...prev }
                      if (v === '__none__') delete next[field]
                      else next[field] = v
                      return next
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not used</SelectItem>
                    {preview.headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <Button onClick={() => runPreview(mapping)} disabled={busy}>
            Read the file again
          </Button>
        </Card>
      )}

      {preview && !preview.needsMapping && (
        <>
          <Card className="p-4">
            <p className="text-sm">
              Read <strong>{preview.summary?.parsed ?? preview.rows.length}</strong> rows.{' '}
              <strong>{preview.summary?.excluded ?? 0}</strong> look like money the ledger already
              holds and start unticked. <strong>{included.length}</strong> selected to import.
              {(preview.summary?.unreadable ?? 0) > 0 && (
                <>
                  {' '}
                  <span className="text-amber-600">
                    {preview.summary?.unreadable} row(s) could not be read.
                  </span>
                </>
              )}
            </p>
          </Card>

          {preview.errors.length > 0 && (
            <Card className="space-y-1 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-amber-600">
                <AlertTriangle className="h-4 w-4" /> Rows that could not be read
              </p>
              {preview.errors.slice(0, 20).map((e) => (
                <p key={e.lineNumber} className="text-muted-foreground">
                  Line {e.lineNumber}: {e.reason}
                </p>
              ))}
              {preview.errors.length > 20 && (
                <p className="text-muted-foreground">…and {preview.errors.length - 20} more.</p>
              )}
            </Card>
          )}

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 w-10">Add</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => {
                    const choice = choices[row.contentHash]
                    if (!choice) return null
                    const wanted = row.amountCents >= 0 ? 'INCOME' : 'EXPENSE'
                    const wrongSide = CATEGORY_DIRECTION[choice.category] !== wanted
                    return (
                      <tr key={row.contentHash} className="border-t align-top">
                        <td className="p-3">
                          <Checkbox
                            checked={choice.include}
                            onCheckedChange={(v) =>
                              setChoice(row.contentHash, { include: v === true })
                            }
                            aria-label={`Import ${row.description}`}
                          />
                        </td>
                        <td className="p-3 whitespace-nowrap">{row.date.slice(0, 10)}</td>
                        <td className="p-3">
                          <div>{row.description}</div>
                          {row.alreadyImported && (
                            <Badge variant="outline" className="mt-1 text-[10px]">
                              imported before
                            </Badge>
                          )}
                          {row.excludedNote && (
                            <p className="mt-1 text-xs text-amber-600">{row.excludedNote}</p>
                          )}
                        </td>
                        <td
                          className={`p-3 text-right whitespace-nowrap ${
                            row.amountCents >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatPrice(row.amountCents / 100)}
                        </td>
                        <td className="p-3">
                          <Select
                            value={choice.category}
                            onValueChange={(v) =>
                              setChoice(row.contentHash, { category: v as Category })
                            }
                          >
                            <SelectTrigger className={wrongSide ? 'border-destructive' : undefined}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LEDGER_CATEGORY_VALUES.filter(
                                (c) => CATEGORY_DIRECTION[c] === wanted
                              ).map((c) => (
                                <SelectItem key={c} value={c}>
                                  {LEDGER_CATEGORY_LABELS[c]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex items-center justify-end gap-3">
            {misfiled.length > 0 && (
              <p className="text-sm text-destructive">
                {misfiled.length} row(s) have a category on the wrong side of the ledger.
              </p>
            )}
            <Button onClick={commit} disabled={busy || included.length === 0}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {included.length} row(s)
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
