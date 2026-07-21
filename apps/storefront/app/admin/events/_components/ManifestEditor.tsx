'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { soldUnits, toCasesAndJars, formatCasesAndJars } from '@/lib/events/manifest-calc'

type ManifestStatus = 'DRAFT' | 'PACKED' | 'RETURNED'

interface Line {
  productId: string
  productName: string
  sku: string
  category: string
  unitsPerCase: number
  expirationDate: string // yyyy-mm-dd or ''
  takenCases: number
  takenJars: number
  returnedCases: number
  returnedJars: number
}

interface ManifestMeta {
  id: string | null
  status: ManifestStatus
  notes: string | null
}

function isChips(category: string): boolean {
  return /chip/i.test(category)
}

function toDateInput(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export default function ManifestEditor({ eventId }: { eventId: string }) {
  const [lines, setLines] = useState<Line[]>([])
  const [meta, setMeta] = useState<ManifestMeta>({ id: null, status: 'DRAFT', notes: null })
  const [eventTitle, setEventTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await fetch(`/api/admin/events/${eventId}/manifest`)
        if (!res.ok) throw new Error('Failed to load manifest')
        const data = await res.json()
        if (!active) return
        setEventTitle(data.event?.title ?? '')
        setMeta({
          id: data.manifest?.id ?? null,
          status: (data.manifest?.status ?? 'DRAFT') as ManifestStatus,
          notes: data.manifest?.notes ?? null,
        })
        setLines(
          (data.lines ?? []).map((l: any) => ({
            productId: l.productId,
            productName: l.productName,
            sku: l.sku,
            category: l.category,
            unitsPerCase: l.unitsPerCase,
            expirationDate: toDateInput(l.expirationDate),
            takenCases: l.takenCases ?? 0,
            takenJars: l.takenJars ?? 0,
            returnedCases: l.returnedCases ?? 0,
            returnedJars: l.returnedJars ?? 0,
          }))
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load manifest')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [eventId])

  function update(index: number, patch: Partial<Line>) {
    setLines((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const grouped = useMemo(() => {
    const map = new Map<string, { line: Line; index: number }[]>()
    lines.forEach((line, index) => {
      const key = line.category || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push({ line, index })
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [lines])

  const showReturns = meta.status === 'PACKED' || meta.status === 'RETURNED'

  const totals = useMemo(() => {
    let takenUnits = 0
    let returnedUnits = 0
    let soldTotal = 0
    let productsTaken = 0
    for (const l of lines) {
      const taken = l.takenCases * (l.unitsPerCase || 1) + l.takenJars
      const returned = l.returnedCases * (l.unitsPerCase || 1) + l.returnedJars
      takenUnits += taken
      returnedUnits += returned
      soldTotal += soldUnits(l)
      if (taken > 0) productsTaken++
    }
    return { takenUnits, returnedUnits, soldTotal, productsTaken }
  }, [lines])

  async function handleSave() {
    // Client-side guard for the "expiration is a must" rule once committed.
    if (meta.status !== 'DRAFT') {
      const missing = lines.filter(
        (l) => (l.takenCases > 0 || l.takenJars > 0) && !l.expirationDate
      )
      if (missing.length > 0) {
        toast.error(`Expiration date required for ${missing.length} product(s) being taken.`)
        return
      }
    }

    setSaving(true)
    try {
      const items = lines
        .filter(
          (l) =>
            l.takenCases > 0 ||
            l.takenJars > 0 ||
            l.returnedCases > 0 ||
            l.returnedJars > 0 ||
            l.expirationDate
        )
        .map((l) => ({
          productId: l.productId,
          expirationDate: l.expirationDate || null,
          takenCases: l.takenCases,
          takenJars: l.takenJars,
          returnedCases: l.returnedCases,
          returnedJars: l.returnedJars,
        }))

      const res = await fetch(`/api/admin/events/${eventId}/manifest`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: meta.status, notes: meta.notes, items }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      toast.success('Manifest saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save manifest')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading manifest…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/admin/events/${eventId}/edit`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Product Manifest</h1>
            <p className="text-muted-foreground">{eventTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-44">
            <Select value={meta.status} onValueChange={(v) => setMeta((m) => ({ ...m, status: v as ManifestStatus }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft (planning)</SelectItem>
                <SelectItem value="PACKED">Packed / Out</SelectItem>
                <SelectItem value="RETURNED">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Manifest
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Products taken</p>
          <p className="text-2xl font-bold">{totals.productsTaken}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Units taken → returned</p>
          <p className="text-2xl font-bold">
            {totals.takenUnits} <span className="text-base font-normal text-muted-foreground">→ {totals.returnedUnits}</span>
          </p>
        </Card>
        <Card className="p-4 bg-primary/5">
          <p className="text-sm text-muted-foreground">Total units sold</p>
          <p className="text-2xl font-bold text-primary">{totals.soldTotal}</p>
        </Card>
      </div>

      {lines.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No active products found. Add products first, then build the manifest.
        </Card>
      ) : (
        grouped.map(([category, rows]) => (
          <Card key={category} className="p-0 overflow-hidden">
            <div className="border-b bg-muted/40 px-4 py-3">
              <h2 className="font-semibold">{category}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2 min-w-[180px]">Product</th>
                    <th className="px-4 py-2">Expiration</th>
                    <th className="px-4 py-2 text-center" colSpan={2}>Taken</th>
                    {showReturns && <th className="px-4 py-2 text-center" colSpan={2}>Returned</th>}
                    <th className="px-4 py-2 text-right min-w-[130px]">Sold</th>
                  </tr>
                  <tr className="border-b text-left text-[10px] uppercase text-muted-foreground/70">
                    <th className="px-4 py-1"></th>
                    <th className="px-4 py-1"></th>
                    <th className="px-4 py-1 text-center">{'Cases'}</th>
                    <th className="px-4 py-1 text-center">Jars</th>
                    {showReturns && <th className="px-4 py-1 text-center">Cases</th>}
                    {showReturns && <th className="px-4 py-1 text-center">Jars</th>}
                    <th className="px-4 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ line, index }) => {
                    const chips = isChips(line.category)
                    const sold = soldUnits(line)
                    const breakdown = toCasesAndJars(sold, line.unitsPerCase)
                    return (
                      <tr key={line.productId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2">
                          <div className="font-medium">{line.productName}</div>
                          <div className="text-xs text-muted-foreground">
                            {line.sku} · {line.unitsPerCase}/case
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="date"
                            className="w-40"
                            value={line.expirationDate}
                            onChange={(e) => update(index, { expirationDate: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Input
                            type="number"
                            min={0}
                            aria-label={`${line.productName} ${chips ? 'boxes' : 'cases'} taken`}
                            className="w-20 text-center"
                            value={line.takenCases || ''}
                            onChange={(e) => update(index, { takenCases: Math.max(0, Number(e.target.value) || 0) })}
                          />
                          {chips && <div className="text-[10px] text-muted-foreground mt-0.5">boxes</div>}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {chips ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              aria-label={`${line.productName} jars taken`}
                              className="w-20 text-center"
                              value={line.takenJars || ''}
                              onChange={(e) => update(index, { takenJars: Math.max(0, Number(e.target.value) || 0) })}
                            />
                          )}
                        </td>
                        {showReturns && (
                          <td className="px-2 py-2 text-center">
                            <Input
                              type="number"
                              min={0}
                              aria-label={`${line.productName} ${chips ? 'boxes' : 'cases'} returned`}
                              className="w-20 text-center"
                              value={line.returnedCases || ''}
                              onChange={(e) => update(index, { returnedCases: Math.max(0, Number(e.target.value) || 0) })}
                            />
                          </td>
                        )}
                        {showReturns && (
                          <td className="px-2 py-2 text-center">
                            {chips ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                aria-label={`${line.productName} jars returned`}
                                className="w-20 text-center"
                                value={line.returnedJars || ''}
                                onChange={(e) => update(index, { returnedJars: Math.max(0, Number(e.target.value) || 0) })}
                              />
                            )}
                          </td>
                        )}
                        <td className="px-4 py-2 text-right">
                          {sold > 0 ? (
                            <div>
                              <div className="font-semibold">
                                {chips
                                  ? `${breakdown.cases} ${breakdown.cases === 1 ? 'box' : 'boxes'}`
                                  : formatCasesAndJars(breakdown.cases, breakdown.jars)}
                              </div>
                              <div className="text-xs text-muted-foreground">{sold} units</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}

      <Card className="p-6 space-y-2">
        <Label htmlFor="manifest-notes">Notes</Label>
        <Textarea
          id="manifest-notes"
          rows={3}
          value={meta.notes ?? ''}
          onChange={(e) => setMeta((m) => ({ ...m, notes: e.target.value }))}
          placeholder="Anything to remember about this load-out…"
        />
      </Card>

      <div className="flex items-center justify-between">
        <Badge variant="outline">
          {meta.status === 'DRAFT' ? 'Draft — not committed' : meta.status === 'PACKED' ? 'Packed / Out' : 'Returned — sold calculated'}
        </Badge>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Manifest
        </Button>
      </div>
    </div>
  )
}
