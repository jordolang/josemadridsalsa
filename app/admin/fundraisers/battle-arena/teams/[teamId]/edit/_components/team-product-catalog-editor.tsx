'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface AdminProductOption {
  id: string
  name: string
  slug: string
  price: string // serialized Decimal
  isActive: boolean
}

export interface AdminTeamProductRow {
  id: string
  productId: string
  price: string | null
  sortOrder: number
  isActive: boolean
  product: {
    id: string
    name: string
    slug: string
    price: string
    isActive: boolean
    featuredImage: string | null
  }
}

export interface TeamProductCatalogEditorProps {
  teamId: string
  initialRows: AdminTeamProductRow[]
  allProducts: AdminProductOption[]
}

/**
 * Admin editor — attach / detach / reprice products on a team's catalog.
 * Changes are persisted individually against the admin API so partial
 * saves are fine; there's no "save everything" button.
 */
export function TeamProductCatalogEditor({
  teamId,
  initialRows,
  allProducts,
}: TeamProductCatalogEditorProps) {
  const router = useRouter()
  const [rows, setRows] = useState<AdminTeamProductRow[]>(initialRows)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successNote, setSuccessNote] = useState<string | null>(null)

  const attachedIds = useMemo(
    () => new Set(rows.map((r) => r.productId)),
    [rows],
  )
  const available = useMemo(
    () => allProducts.filter((p) => !attachedIds.has(p.id)),
    [allProducts, attachedIds],
  )

  function flashSuccess(msg: string) {
    setSuccessNote(msg)
    setError(null)
    setTimeout(() => setSuccessNote((s) => (s === msg ? null : s)), 1800)
  }

  async function attachProduct() {
    if (!selectedProductId) return
    setPendingAction('attach')
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/fundraiser-teams/${teamId}/products`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            productId: selectedProductId,
            sortOrder: rows.length,
          }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        setError(
          typeof data?.error === 'string' ? data.error : 'Could not attach',
        )
        return
      }
      setRows((r) => [...r, data.teamProduct])
      setSelectedProductId('')
      flashSuccess('Added to catalog')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setPendingAction(null)
    }
  }

  async function updateRow(
    row: AdminTeamProductRow,
    patch: Partial<{ price: number | null; sortOrder: number; isActive: boolean }>,
  ) {
    setPendingAction(`update:${row.id}`)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/fundraiser-teams/${teamId}/products/${row.id}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        setError(
          typeof data?.error === 'string' ? data.error : 'Could not update',
        )
        return
      }
      setRows((rs) =>
        rs.map((x) => (x.id === row.id ? data.teamProduct : x)),
      )
      flashSuccess('Saved')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setPendingAction(null)
    }
  }

  async function detachRow(row: AdminTeamProductRow) {
    if (!confirm(`Remove ${row.product.name} from this team's catalog?`))
      return
    setPendingAction(`delete:${row.id}`)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/fundraiser-teams/${teamId}/products/${row.id}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(
          typeof data?.error === 'string' ? data.error : 'Could not remove',
        )
        return
      }
      setRows((rs) => rs.filter((x) => x.id !== row.id))
      flashSuccess('Removed')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Product catalog</h2>
          <p className="text-sm text-muted-foreground">
            Products listed here appear on the team&apos;s public fundraiser
            page. Every purchase triggers the Battle Arena damage engine.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1 space-y-1">
          <Label htmlFor="attach-product">Attach product</Label>
          <Select
            value={selectedProductId}
            onValueChange={setSelectedProductId}
          >
            <SelectTrigger id="attach-product">
              <SelectValue placeholder="Select a product…" />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  All products already attached
                </SelectItem>
              ) : (
                available.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · ${p.price}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          onClick={attachProduct}
          disabled={!selectedProductId || pendingAction === 'attach'}
        >
          {pendingAction === 'attach' ? 'Adding…' : 'Add to catalog'}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No products attached yet. Add one above to let supporters buy salsa
          for this team.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-3"
            >
              <div className="flex-1 min-w-48">
                <p className="font-medium">{row.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  Base ${Number(row.product.price).toFixed(2)} · {row.product.slug}
                  {!row.product.isActive ? ' · product inactive' : ''}
                </p>
              </div>

              <div className="w-28 space-y-1">
                <Label className="text-xs" htmlFor={`price-${row.id}`}>
                  Override $
                </Label>
                <Input
                  id={`price-${row.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={row.price ?? ''}
                  placeholder="base"
                  onBlur={(e) => {
                    const raw = e.target.value.trim()
                    const next = raw === '' ? null : Number(raw)
                    if (next !== null && (!Number.isFinite(next) || next <= 0))
                      return
                    const existing =
                      row.price === null ? null : Number(row.price)
                    if (existing === next) return
                    updateRow(row, { price: next })
                  }}
                />
              </div>

              <div className="w-20 space-y-1">
                <Label className="text-xs" htmlFor={`order-${row.id}`}>
                  Sort
                </Label>
                <Input
                  id={`order-${row.id}`}
                  type="number"
                  min="0"
                  defaultValue={row.sortOrder}
                  onBlur={(e) => {
                    const next = Number(e.target.value)
                    if (!Number.isFinite(next) || next === row.sortOrder) return
                    updateRow(row, { sortOrder: next })
                  }}
                />
              </div>

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={row.isActive}
                  onChange={(e) =>
                    updateRow(row, { isActive: e.target.checked })
                  }
                />
                Active
              </label>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => detachRow(row)}
                disabled={pendingAction === `delete:${row.id}`}
                aria-label={`Remove ${row.product.name}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {successNote && (
        <p className="rounded bg-emerald-500/10 p-2 text-xs text-emerald-700">
          {successNote}
        </p>
      )}
    </Card>
  )
}
