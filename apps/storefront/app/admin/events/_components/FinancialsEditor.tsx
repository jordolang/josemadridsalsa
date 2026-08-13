'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ClipboardList, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'
import { computeShowFinancials } from '@/lib/events/show-financials'

/** The eight money fields, held as numbers (or null for "not entered") plus the free-text note. */
interface Financials {
  boothFee: number | null
  costOfFuel: number | null
  lodging: number | null
  meals: number | null
  otherExpenses: number | null
  otherExpensesNote: string | null
  cashSales: number | null
  cardSales: number | null
}

interface ManifestCrossCheck {
  unitsSold: number
  estimatedRevenue: number
}

const EMPTY: Financials = {
  boothFee: null,
  costOfFuel: null,
  lodging: null,
  meals: null,
  otherExpenses: null,
  otherExpensesNote: null,
  cashSales: null,
  cardSales: null,
}

/** Parse a currency input into a number, or null when the field is cleared. */
function toMoney(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const COST_FIELDS: Array<{ key: keyof Financials; label: string; hint?: string }> = [
  { key: 'boothFee', label: 'Booth / show fee', hint: 'What the space cost' },
  { key: 'costOfFuel', label: 'Fuel' },
  { key: 'lodging', label: 'Lodging' },
  { key: 'meals', label: 'Meals' },
  { key: 'otherExpenses', label: 'Other expenses', hint: 'Tolls, ice, anything else' },
]

export default function FinancialsEditor({ eventId }: { eventId: string }) {
  const [values, setValues] = useState<Financials>(EMPTY)
  const [manifest, setManifest] = useState<ManifestCrossCheck>({ unitsSold: 0, estimatedRevenue: 0 })
  const [eventTitle, setEventTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await fetch(`/api/admin/events/${eventId}/financials`)
        if (!res.ok) throw new Error('Failed to load financials')
        const data = await res.json()
        if (!active) return
        setEventTitle(data.event?.title ?? '')
        setValues({ ...EMPTY, ...(data.financials ?? {}) })
        setManifest({
          unitsSold: data.manifest?.unitsSold ?? 0,
          estimatedRevenue: data.manifest?.estimatedRevenue ?? 0,
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load financials')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [eventId])

  const summary = useMemo(() => computeShowFinancials(values), [values])

  function setMoney(key: keyof Financials, raw: string) {
    setValues((v) => ({ ...v, [key]: toMoney(raw) }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/events/${eventId}/financials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      const data = await res.json()
      setValues({ ...EMPTY, ...(data.financials ?? {}) })
      setManifest({
        unitsSold: data.manifest?.unitsSold ?? manifest.unitsSold,
        estimatedRevenue: data.manifest?.estimatedRevenue ?? manifest.estimatedRevenue,
      })
      toast.success('Financials saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save financials')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading financials…</div>
  }

  const profitPositive = summary.netProfit >= 0
  const tillVsManifest = summary.totalSales - manifest.estimatedRevenue

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
            <h1 className="text-3xl font-bold">Show Financials</h1>
            <p className="text-muted-foreground">{eventTitle}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Financials
        </Button>
      </div>

      {/* Break-even summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total costs</p>
          <p className="text-2xl font-bold">{formatPrice(summary.totalExpenses)}</p>
          <p className="text-xs text-muted-foreground">what the show has to earn back</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total sales</p>
          <p className="text-2xl font-bold">{formatPrice(summary.totalSales)}</p>
          <p className="text-xs text-muted-foreground">cash + card taken</p>
        </Card>
        <Card className={`p-4 ${profitPositive ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
          <p className="text-sm text-muted-foreground">{profitPositive ? 'Net profit' : 'Net loss'}</p>
          <p className={`text-2xl font-bold ${profitPositive ? 'text-green-600' : 'text-red-600'}`}>
            {formatPrice(summary.netProfit)}
          </p>
          <p className="text-xs text-muted-foreground">
            {summary.margin !== null ? `${Math.round(summary.margin * 100)}% margin` : 'no sales yet'}
          </p>
        </Card>
        <Card className="p-4 bg-primary/5">
          <p className="text-sm text-muted-foreground">
            {summary.hasBrokenEven ? 'Cleared break-even' : 'Left to break even'}
          </p>
          <p className="text-2xl font-bold text-primary">
            {summary.hasBrokenEven ? formatPrice(summary.netProfit) : formatPrice(summary.amountToBreakEven)}
          </p>
          <p className="text-xs text-muted-foreground">
            {summary.hasBrokenEven ? 'the show has paid for itself' : 'more to sell to cover costs'}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Costs */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="font-semibold">Costs</h2>
            <p className="text-sm text-muted-foreground">Every dollar spent on this show.</p>
          </div>
          <div className="space-y-3">
            {COST_FIELDS.map((field) => (
              <div key={field.key} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div>
                  <Label htmlFor={`cost-${field.key}`}>{field.label}</Label>
                  {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                </div>
                <div className="relative w-36">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id={`cost-${field.key}`}
                    type="number"
                    min={0}
                    step="0.01"
                    className="pl-6 text-right"
                    value={(values[field.key] as number | null) ?? ''}
                    onChange={(e) => setMoney(field.key, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="other-note">Other expenses — what were they?</Label>
            <Textarea
              id="other-note"
              rows={2}
              value={values.otherExpensesNote ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, otherExpensesNote: e.target.value }))}
              placeholder="e.g. $12 tolls, $8 ice"
            />
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm font-medium">Total costs</span>
            <span className="text-lg font-bold">{formatPrice(summary.totalExpenses)}</span>
          </div>
        </Card>

        {/* Sales */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="font-semibold">Sales</h2>
            <p className="text-sm text-muted-foreground">The money taken at the show.</p>
          </div>
          <div className="space-y-3">
            {(['cashSales', 'cardSales'] as const).map((key) => (
              <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <Label htmlFor={`sale-${key}`}>{key === 'cashSales' ? 'Cash sales' : 'Credit-card sales'}</Label>
                <div className="relative w-36">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id={`sale-${key}`}
                    type="number"
                    min={0}
                    step="0.01"
                    className="pl-6 text-right"
                    value={values[key] ?? ''}
                    onChange={(e) => setMoney(key, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm font-medium">Total sales</span>
            <span className="text-lg font-bold">{formatPrice(summary.totalSales)}</span>
          </div>

          {/* Manifest cross-check */}
          <div className="rounded-lg bg-muted/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">From the manifest</span>
              <Link href={`/admin/events/${eventId}/manifest`}>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  <ClipboardList className="h-3.5 w-3.5" /> Open manifest
                </Button>
              </Link>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Units sold</span>
              <span className="font-medium">{manifest.unitsSold}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Est. retail value</span>
              <span className="font-medium">{formatPrice(manifest.estimatedRevenue)}</span>
            </div>
            {manifest.estimatedRevenue > 0 && (
              <p className="text-xs text-muted-foreground">
                Recorded sales are {formatPrice(Math.abs(tillVsManifest))}{' '}
                {tillVsManifest >= 0 ? 'above' : 'below'} the manifest’s estimate — samples,
                discounts and tax explain the gap.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Badge variant={summary.hasBrokenEven ? 'default' : 'outline'}>
          {summary.hasBrokenEven
            ? `Profit ${formatPrice(summary.netProfit)}`
            : `${formatPrice(summary.amountToBreakEven)} to break even`}
        </Badge>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Financials
        </Button>
      </div>
    </div>
  )
}
