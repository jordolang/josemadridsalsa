'use client'

import { useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
// From `ledger` rather than `ledger-export`: the latter reaches `lib/csv`, and PapaParse has no
// business in a browser bundle just to render three option labels.
import {
  LEDGER_EXPORT_FORMATS,
  LEDGER_EXPORT_FORMAT_LABELS,
  type LedgerExportFormat,
} from '@/lib/financials/ledger'

/** What each format is for, in the words of the person deciding which one they need. */
const FORMAT_HELP: Record<LedgerExportFormat, string> = {
  detail:
    'Every column of every row, for a spreadsheet or a backup. Not an import file.',
  'qbo-bank':
    'QuickBooks Online → Banking → Upload from file. Lists cash movements only, so cost of goods and discounts — which moved no money on their own — are left out.',
  'qbo-journal':
    'The journal-entry import in QuickBooks Online Advanced. Full double-entry: each row becomes a balanced debit and credit against your mapped accounts.',
}

interface Props {
  /** The filters currently applied to the list, so the file matches what is on screen. */
  filters: URLSearchParams
  onClose: () => void
  /** Rows may have been stamped as exported, so the list needs re-reading. */
  onExported: () => void
}

export default function LedgerExportPanel({ filters, onClose, onExported }: Props) {
  const [format, setFormat] = useState<LedgerExportFormat>('qbo-journal')
  const [onlyUnexported, setOnlyUnexported] = useState(false)
  const [markExported, setMarkExported] = useState(false)
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const params = new URLSearchParams(filters)
      params.set('format', format)
      if (onlyUnexported) params.set('onlyUnexported', 'true')
      if (markExported) params.set('markExported', 'true')

      const res = await fetch(`/api/admin/financials/ledger/export?${params.toString()}`)
      if (!res.ok) {
        // The route answers with JSON on failure — surface its reason instead of saving an
        // error page to the user's downloads folder with a .csv extension.
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Export failed')
      }

      const blob = await res.blob()
      const name =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'ledger.csv'

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast.success(`Downloaded ${name}`)
      if (markExported) onExported()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-6 space-y-4 border-primary/40">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Export the ledger</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close export panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Exports exactly the rows your filters are showing, oldest first.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as LedgerExportFormat)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEDGER_EXPORT_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {LEDGER_EXPORT_FORMAT_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{FORMAT_HELP[format]}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id="ledger-export-only-unexported"
              checked={onlyUnexported}
              onCheckedChange={(v) => setOnlyUnexported(v === true)}
            />
            <div>
              <Label htmlFor="ledger-export-only-unexported" className="text-sm">
                Only rows not yet sent to QuickBooks
              </Label>
              <p className="text-xs text-muted-foreground">
                Everything since the last export you marked.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="ledger-export-mark"
              checked={markExported}
              onCheckedChange={(v) => setMarkExported(v === true)}
            />
            <div>
              <Label htmlFor="ledger-export-mark" className="text-sm">
                Mark these rows as exported
              </Label>
              <p className="text-xs text-muted-foreground">
                Tick this once you intend to import the file. Leave it off to take a copy without
                changing anything.
              </p>
            </div>
          </div>
        </div>
      </div>

      {format === 'qbo-journal' && (
        <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          Account names come from the QuickBooks mapping in{' '}
          <span className="font-medium">Settings → Integrations → QuickBooks</span>. Where a
          category has not been mapped, a standard QuickBooks account name is suggested — check the
          file against your chart of accounts before importing.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={download} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download CSV
        </Button>
      </div>
    </Card>
  )
}
