'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Camera, CheckCircle2, Loader2, RefreshCw, TriangleAlert, X } from 'lucide-react'

import { useUploadThing } from '@/lib/uploadthing-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface CaptureLine {
  id: string
  lineNumber: number
  label: string
  direction: 'INCOME' | 'EXPENSE'
  category: string
  amountCents: number
  quantity: number | null
  confidence: number | null
  rawValue: string | null
  edited: boolean
  excluded: boolean
}

export interface CaptureSummary {
  id: string
  formType: string
  status: string
  fileUrl: string
  fileName: string | null
  capturedOn: string | null
  statedTotalCents: number | null
  reconciled: boolean | null
  minConfidence: number | null
  extractionError: string | null
  duplicateOfId: string | null
  uploadedAt: string
  lines: CaptureLine[]
}

const FORM_TYPES = [
  { value: 'SHOW_SETTLEMENT', label: 'Show settlement sheet' },
  { value: 'FARMERS_MARKET', label: 'Farmers market day sheet' },
  { value: 'FUNDRAISER_ORDER', label: 'Fundraiser order form' },
  { value: 'MILEAGE_LOG', label: 'Mileage log' },
  { value: 'EXPENSE_RECEIPT', label: 'Expense receipt' },
  { value: 'OTHER', label: 'Something else' },
] as const

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** SHA-256 of the file bytes — the same key the server uses to refuse a duplicate photo. */
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  UPLOADED: { label: 'Uploaded', className: 'bg-slate-100 text-slate-700' },
  EXTRACTING: { label: 'Reading…', className: 'bg-blue-100 text-blue-800' },
  NEEDS_REVIEW: { label: 'Needs you', className: 'bg-amber-100 text-amber-900' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800' },
  POSTED: { label: 'In the books', className: 'bg-emerald-600 text-white' },
  FAILED: { label: 'Could not read', className: 'bg-red-100 text-red-800' },
  REJECTED: { label: 'Rejected', className: 'bg-slate-200 text-slate-600' },
}

export function CaptureClient({
  initialCaptures,
  canWrite,
}: {
  initialCaptures: CaptureSummary[]
  canWrite: boolean
}) {
  const [captures, setCaptures] = useState(initialCaptures)
  const [formType, setFormType] = useState<string>('SHOW_SETTLEMENT')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { startUpload } = useUploadThing('formCapture')

  const needsReview = useMemo(
    () => captures.filter((capture) => capture.status === 'NEEDS_REVIEW' || capture.status === 'FAILED'),
    [captures]
  )
  const settled = useMemo(
    () => captures.filter((capture) => capture.status !== 'NEEDS_REVIEW' && capture.status !== 'FAILED'),
    [captures]
  )

  const refresh = useCallback(async () => {
    const response = await fetch('/api/admin/form-captures?take=40')
    if (!response.ok) return
    const data = await response.json()
    setCaptures(data.captures ?? [])
  }, [])

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setMessage(null)

    try {
      const list = Array.from(files)
      const hashes = await Promise.all(list.map(hashFile))
      const uploaded = await startUpload(list)
      if (!uploaded?.length) throw new Error('Upload failed. Check your connection and try again.')

      let created = 0
      let duplicates = 0

      for (const [index, result] of uploaded.entries()) {
        const response = await fetch('/api/admin/form-captures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: result.url,
            fileName: list[index]?.name ?? null,
            mimeType: list[index]?.type ?? null,
            fileHash: hashes[index],
            formType,
          }),
        })

        if (response.status === 409) {
          duplicates += 1
          continue
        }
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error ?? 'Could not record that form.')
        }
        created += 1
      }

      await refresh()

      const parts: string[] = []
      if (created) parts.push(`${created} form${created === 1 ? '' : 's'} read`)
      if (duplicates) parts.push(`${duplicates} already captured`)
      setMessage({ tone: 'ok', text: parts.join(' · ') || 'Nothing new to add.' })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Upload failed.' })
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function act(captureId: string, action: 'approve' | 'reject' | 'reextract') {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/form-captures/${captureId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? 'That did not work.')

      await refresh()
      if (action === 'approve') {
        setMessage({ tone: 'ok', text: `Posted ${body.posted} line${body.posted === 1 ? '' : 's'} to the ledger.` })
      }
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Action failed.' })
    } finally {
      setBusy(false)
    }
  }

  async function editLine(captureId: string, lineId: string, patch: Partial<CaptureLine>) {
    const response = await fetch(`/api/admin/form-captures/${captureId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: [{ id: lineId, ...patch }] }),
    })
    if (response.ok) await refresh()
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Capture a form</h1>
        <p className="text-sm text-muted-foreground">
          Photograph the sheet. It gets read, checked against its own total, and turned into ledger
          entries. You only get asked about the ones that do not add up.
        </p>
      </header>

      {/* ---- capture ---- */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="formType">What is this?</Label>
            <select
              id="formType"
              value={formType}
              onChange={(event) => setFormType(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
            >
              {FORM_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />

          <Button
            type="button"
            size="lg"
            className="h-14 w-full text-base"
            disabled={busy || !canWrite}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Camera className="mr-2 h-5 w-5" aria-hidden />
            )}
            {busy ? 'Reading…' : 'Take photo'}
          </Button>

          {!canWrite && (
            <p className="text-sm text-muted-foreground">
              You can review captured forms but not add or post them.
            </p>
          )}

          {message && (
            <p
              className={
                message.tone === 'ok'
                  ? 'text-sm font-medium text-emerald-700'
                  : 'text-sm font-medium text-red-700'
              }
              role="status"
            >
              {message.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ---- the queue that needs a person ---- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Needs you{' '}
          <span className="text-muted-foreground">({needsReview.length})</span>
        </h2>
        {needsReview.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing waiting. Everything captured so far added up on its own.
          </p>
        )}
        {needsReview.map((capture) => (
          <CaptureCard
            key={capture.id}
            capture={capture}
            canWrite={canWrite}
            busy={busy}
            onAct={act}
            onEditLine={editLine}
          />
        ))}
      </section>

      {/* ---- everything else ---- */}
      {settled.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Recently captured</h2>
          {settled.map((capture) => (
            <CaptureCard
              key={capture.id}
              capture={capture}
              canWrite={canWrite}
              busy={busy}
              onAct={act}
              onEditLine={editLine}
              collapsed
            />
          ))}
        </section>
      )}
    </div>
  )
}

function CaptureCard({
  capture,
  canWrite,
  busy,
  onAct,
  onEditLine,
  collapsed = false,
}: {
  capture: CaptureSummary
  canWrite: boolean
  busy: boolean
  onAct: (id: string, action: 'approve' | 'reject' | 'reextract') => void
  onEditLine: (captureId: string, lineId: string, patch: Partial<CaptureLine>) => void
  collapsed?: boolean
}) {
  const [open, setOpen] = useState(!collapsed)
  const style = STATUS_STYLE[capture.status] ?? STATUS_STYLE.UPLOADED

  const lineSum = capture.lines
    .filter((line) => !line.excluded && line.direction === 'INCOME')
    .reduce((sum, line) => sum + line.amountCents, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {capture.formType.toLowerCase().replace(/_/g, ' ')}
            {capture.capturedOn && (
              <span className="ml-2 font-normal text-muted-foreground">
                {new Date(capture.capturedOn).toLocaleDateString('en-US', { timeZone: 'UTC' })}
              </span>
            )}
          </CardTitle>
          <Badge className={style.className}>{style.label}</Badge>
        </div>

        {capture.duplicateOfId && (
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Same form type and date as one already captured. Check this is not the same sheet twice.
          </p>
        )}

        {capture.reconciled === false && (
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            The form says {formatCents(capture.statedTotalCents ?? 0)} but the rows add up to{' '}
            {formatCents(lineSum)}.
          </p>
        )}

        {capture.extractionError && (
          <p className="flex items-start gap-2 text-sm text-red-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {capture.extractionError}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {collapsed && (
          <Button variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
            {open ? 'Hide detail' : 'Show detail'}
          </Button>
        )}

        {open && (
          <>
            <a
              href={capture.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-md border"
            >
              {/* The photo is the evidence; a reviewer must be able to see it beside the numbers. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capture.fileUrl}
                alt={`Photographed ${capture.formType.toLowerCase().replace(/_/g, ' ')}`}
                className="max-h-80 w-full object-contain"
              />
            </a>

            <ul className="divide-y rounded-md border">
              {capture.lines.map((line) => (
                <li
                  key={line.id}
                  className={`flex items-center gap-3 p-3 ${line.excluded ? 'opacity-40' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.direction === 'INCOME' ? 'Money in' : 'Money out'} ·{' '}
                      {line.category.toLowerCase().replace(/_/g, ' ')}
                      {line.confidence !== null && line.confidence < 0.9 && (
                        <span className="ml-1 font-medium text-amber-700">
                          · read as “{line.rawValue}”
                        </span>
                      )}
                    </p>
                  </div>

                  {line.quantity !== null ? (
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {line.quantity} units
                    </span>
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      defaultValue={(line.amountCents / 100).toFixed(2)}
                      disabled={!canWrite || capture.status === 'POSTED' || busy}
                      className="h-9 w-28 shrink-0 text-right tabular-nums"
                      onBlur={(event) => {
                        const next = Math.round(Number(event.target.value) * 100)
                        if (Number.isFinite(next) && next !== line.amountCents) {
                          onEditLine(capture.id, line.id, { amountCents: next })
                        }
                      }}
                    />
                  )}

                  {canWrite && capture.status !== 'POSTED' && (
                    <button
                      type="button"
                      aria-label={line.excluded ? `Include ${line.label}` : `Exclude ${line.label}`}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
                      disabled={busy}
                      onClick={() => onEditLine(capture.id, line.id, { excluded: !line.excluded })}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
              {capture.lines.length === 0 && (
                <li className="p-3 text-sm text-muted-foreground">No figures were read off this form.</li>
              )}
            </ul>

            {canWrite && capture.status !== 'POSTED' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => onAct(capture.id, 'approve')}
                  disabled={busy || capture.lines.length === 0}
                  className="flex-1"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                  Post to ledger
                </Button>
                <Button variant="outline" onClick={() => onAct(capture.id, 'reextract')} disabled={busy}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                  Read again
                </Button>
                <Button variant="ghost" onClick={() => onAct(capture.id, 'reject')} disabled={busy}>
                  Discard
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
