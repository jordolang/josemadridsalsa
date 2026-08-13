'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Loader2, Plus, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'
import {
  LEDGER_CATEGORY_LABELS,
  LEDGER_CATEGORY_VALUES,
  CATEGORY_DIRECTION,
} from '@/lib/financials/ledger'

interface Entry {
  id: string
  date: string
  direction: 'INCOME' | 'EXPENSE'
  amountCents: number
  category: keyof typeof LEDGER_CATEGORY_LABELS
  source: string
  description: string
  counterparty: string | null
  paymentMethod: string | null
  memo: string | null
  isManual: boolean
}

interface Summary {
  incomeCents: number
  expenseCents: number
  netCents: number
}

const usd = (cents: number) => formatPrice(cents / 100)
const today = () => new Date().toISOString().slice(0, 10)

interface FormState {
  id: string | null
  /** Manual rows are fully editable; derived rows (from orders/refunds/shows) allow only a note. */
  manual: boolean
  date: string
  category: (typeof LEDGER_CATEGORY_VALUES)[number]
  amountDollars: string
  description: string
  counterparty: string
  paymentMethod: string
  memo: string
}

const EMPTY_FORM: FormState = {
  id: null,
  manual: true,
  date: today(),
  category: 'OTHER_EXPENSE',
  amountDollars: '',
  description: '',
  counterparty: '',
  paymentMethod: '',
  memo: '',
}

const PAGE_SIZE = 100

export default function LedgerClient({ canWrite }: { canWrite: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [summary, setSummary] = useState<Summary>({ incomeCents: 0, expenseCents: 0, netCents: 0 })
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filters
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [direction, setDirection] = useState('all')
  const [category, setCategory] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  // The server owns the page size; mirror what it reports rather than hard-coding a second copy.
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const requestRef = useRef(0)

  // Add/edit form
  const [form, setForm] = useState<FormState | null>(null)

  // Apply a filter change and return to page 1 in the same update, so exactly one request goes out
  // (rather than one for the old page and another after a separate reset).
  function changeFilter(apply: () => void) {
    apply()
    setPage(1)
  }

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (from) p.set('from', from)
      if (to) p.set('to', to)
      if (direction !== 'all') p.set('direction', direction)
      if (category !== 'all') p.set('category', category)
      if (q.trim()) p.set('q', q.trim())
      p.set('page', String(page))

      const res = await fetch(`/api/admin/financials/ledger?${p.toString()}`)
      if (!res.ok) throw new Error('Failed to load ledger')
      const data = await res.json()
      // Ignore a response that a newer request has already superseded, so a slow old page cannot
      // overwrite the current view.
      if (requestId !== requestRef.current) return
      setEntries(data.entries ?? [])
      setSummary(data.summary ?? { incomeCents: 0, expenseCents: 0, netCents: 0 })
      setTotalCount(data.totalCount ?? 0)
      if (typeof data.pageSize === 'number' && data.pageSize > 0) setPageSize(data.pageSize)
    } catch (err) {
      if (requestId === requestRef.current) {
        toast.error(err instanceof Error ? err.message : 'Failed to load ledger')
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [from, to, direction, category, q, page])

  useEffect(() => {
    load()
  }, [load])

  // After a load, if a delete shrank the results past the current page, step back onto a real one.
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalCount / pageSize))
    if (page > maxPage) setPage(maxPage)
  }, [totalCount, pageSize, page])

  function startAdd() {
    setForm({ ...EMPTY_FORM, date: today() })
  }

  function startEdit(entry: Entry) {
    setForm({
      id: entry.id,
      manual: entry.isManual,
      date: entry.date.slice(0, 10),
      category: entry.category,
      amountDollars: (entry.amountCents / 100).toFixed(2),
      description: entry.description,
      counterparty: entry.counterparty ?? '',
      paymentMethod: entry.paymentMethod ?? '',
      memo: entry.memo ?? '',
    })
  }

  async function saveForm() {
    if (!form) return

    // Derived rows: the server accepts only a note, so send only that rather than a full payload
    // it would silently discard.
    if (form.id && !form.manual) {
      setSaving(true)
      try {
        const res = await fetch(`/api/admin/financials/ledger/${form.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memo: form.memo.trim() || null }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
        toast.success('Note updated')
        setForm(null)
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save note')
      } finally {
        setSaving(false)
      }
      return
    }

    const amount = Number(form.amountDollars)
    if (!Number.isFinite(amount) || amount < 0.01) {
      toast.error('Enter an amount of at least $0.01')
      return
    }
    if (!form.description.trim()) {
      toast.error('Add a description')
      return
    }

    setSaving(true)
    try {
      const payload = {
        date: form.date,
        category: form.category,
        amountDollars: amount,
        description: form.description.trim(),
        counterparty: form.counterparty.trim() || null,
        paymentMethod: form.paymentMethod.trim() || null,
        memo: form.memo.trim() || null,
      }
      const res = await fetch(
        form.id ? `/api/admin/financials/ledger/${form.id}` : '/api/admin/financials/ledger',
        {
          method: form.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      toast.success(form.id ? 'Entry updated' : 'Entry added')
      setForm(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save entry')
    } finally {
      setSaving(false)
    }
  }

  async function remove(entry: Entry) {
    if (!confirm(`Delete "${entry.description}"?`)) return
    try {
      const res = await fetch(`/api/admin/financials/ledger/${entry.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
      toast.success('Entry deleted')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete entry')
    }
  }

  const formDirection = useMemo(
    () => (form ? CATEGORY_DIRECTION[form.category] : null),
    [form]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Bookkeeping Ledger</h1>
          <p className="text-muted-foreground">Every dollar in and out — one running total.</p>
        </div>
        {canWrite && (
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" /> Add entry
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4 bg-green-500/5">
          <p className="text-sm text-muted-foreground">Money in</p>
          <p className="text-2xl font-bold text-green-600">{usd(summary.incomeCents)}</p>
        </Card>
        <Card className="p-4 bg-red-500/5">
          <p className="text-sm text-muted-foreground">Money out</p>
          <p className="text-2xl font-bold text-red-600">{usd(summary.expenseCents)}</p>
        </Card>
        <Card className={`p-4 ${summary.netCents >= 0 ? 'bg-primary/5' : 'bg-red-500/10'}`}>
          <p className="text-sm text-muted-foreground">Net</p>
          <p className="text-2xl font-bold">{usd(summary.netCents)}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => changeFilter(() => setFrom(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => changeFilter(() => setTo(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Direction</Label>
            <Select value={direction} onValueChange={(v) => changeFilter(() => setDirection(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="INCOME">Money in</SelectItem>
                <SelectItem value="EXPENSE">Money out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => changeFilter(() => setCategory(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {LEDGER_CATEGORY_VALUES.map((c) => (
                  <SelectItem key={c} value={c}>{LEDGER_CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Search</Label>
            <Input placeholder="Description, name…" value={q} onChange={(e) => changeFilter(() => setQ(e.target.value))} />
          </div>
        </div>
      </Card>

      {/* Add/edit form */}
      {form && (
        <Card className="p-6 space-y-4 border-primary/40">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              {!form.manual ? 'Add a note' : form.id ? 'Edit entry' : 'New entry'}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setForm(null)}><X className="h-4 w-4" /></Button>
          </div>
          {!form.manual ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <div className="font-medium">{form.description}</div>
                <div className="text-xs text-muted-foreground">
                  This row is kept in sync from its source, so only a note can be edited here.
                </div>
              </div>
              <div>
                <Label>Note</Label>
                <Input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as FormState['category'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEDGER_CATEGORY_VALUES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {LEDGER_CATEGORY_LABELS[c]} ({CATEGORY_DIRECTION[c] === 'INCOME' ? 'in' : 'out'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amountDollars}
                  onChange={(e) => setForm({ ...form, amountDollars: e.target.value })}
                />
                {formDirection && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Counts as money {formDirection === 'INCOME' ? 'in' : 'out'}.
                  </p>
                )}
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this?" />
              </div>
              <div>
                <Label>Who (customer / vendor)</Label>
                <Input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} />
              </div>
              <div>
                <Label>Paid by</Label>
                <Input value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} placeholder="cash, card, check…" />
              </div>
              <div>
                <Label>Note</Label>
                <Input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={saveForm} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {!form.manual ? 'Save note' : form.id ? 'Save changes' : 'Add entry'}
            </Button>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2 text-right">In</th>
                <th className="px-4 py-2 text-right">Out</th>
                {canWrite && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canWrite ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={canWrite ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">No entries match these filters.</td></tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 whitespace-nowrap">{e.date.slice(0, 10)}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{e.description}</div>
                      {e.counterparty && <div className="text-xs text-muted-foreground">{e.counterparty}</div>}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">{LEDGER_CATEGORY_LABELS[e.category]}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-muted-foreground">{e.isManual ? 'Manual' : e.source}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-green-700">
                      {e.direction === 'INCOME' ? usd(e.amountCents) : ''}
                    </td>
                    <td className="px-4 py-2 text-right text-red-700">
                      {e.direction === 'EXPENSE' ? usd(e.amountCents) : ''}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(e)}>Edit</Button>
                        {e.isManual && (
                          <Button variant="ghost" size="sm" onClick={() => remove(e)} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Showing {entries.length ? (page - 1) * pageSize + 1 : 0}–{(page - 1) * pageSize + entries.length} of{' '}
          {totalCount}. Derived rows (from orders, refunds and shows) can have their note edited but
          are kept in sync automatically; only manual rows can be deleted.
        </p>
        {totalCount > pageSize && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(totalCount / pageSize) || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
