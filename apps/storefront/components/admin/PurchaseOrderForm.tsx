'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface SupplierOption {
  id: string
  name: string
}

export interface ProductOption {
  id: string
  name: string
  sku: string
  inventory: number
  lowStockThreshold: number
  costPrice: number | null
}

interface Line {
  productId: string
  quantityOrdered: number
  unitCost: number
}

/**
 * Draft a purchase order.
 *
 * Unit cost prefills from `Product.costPrice` where one is recorded, because retyping a price
 * you already know is how the wrong price gets entered — but it stays editable, since the
 * whole point of a purchase order is what this supplier is charging *this time*. What gets
 * saved is the line's cost; `costPrice` is never written back from here.
 */
export function PurchaseOrderForm({
  suppliers,
  products,
}: {
  suppliers: SupplierOption[]
  products: ProductOption[]
}) {
  const router = useRouter()
  const [supplierId, setSupplierId] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [shippingCost, setShippingCost] = useState('0')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const chosen = useMemo(() => new Set(lines.map((l) => l.productId)), [lines])
  const available = products.filter((p) => !chosen.has(p.id))

  const subtotal = lines.reduce((sum, line) => sum + line.unitCost * line.quantityOrdered, 0)
  const total = subtotal + (Number(shippingCost) || 0)

  function addLine(productId: string) {
    const product = productsById.get(productId)
    if (!product) return
    setLines((prev) => [
      ...prev,
      {
        productId,
        // Default to enough to clear the low-stock threshold with headroom, since that is
        // usually why someone is ordering. Editable, obviously.
        quantityOrdered: Math.max(1, product.lowStockThreshold * 2 - product.inventory),
        unitCost: product.costPrice ?? 0,
      },
    ])
  }

  async function submit(shouldSubmit: boolean) {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          expectedAt: expectedAt || undefined,
          shippingCost: Number(shippingCost) || 0,
          notes: notes.trim() || undefined,
          items: lines,
          submit: shouldSubmit,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? 'Could not create the purchase order')
        return
      }

      toast.success(shouldSubmit ? 'Purchase order submitted' : 'Draft saved')
      router.push(`/admin/purchase-orders/${data.purchaseOrder.id}`)
    } catch {
      toast.error('Could not create the purchase order')
    } finally {
      setIsSaving(false)
    }
  }

  if (suppliers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No suppliers yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A purchase order is placed with a supplier, so add one first.
          </p>
          <Button className="mt-4" onClick={() => router.push('/admin/purchase-orders/suppliers')}>
            Add a supplier
          </Button>
        </CardContent>
      </Card>
    )
  }

  const canSave = supplierId !== '' && lines.length > 0 && lines.every((l) => l.quantityOrdered > 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="po-supplier">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="po-supplier">
                  <SelectValue placeholder="Choose a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="po-expected">Expected date</Label>
              <Input
                id="po-expected"
                type="date"
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="po-shipping">Shipping cost</Label>
              <Input
                id="po-shipping"
                type="number"
                min={0}
                step="0.01"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="po-notes">Notes (optional)</Label>
            <Textarea
              id="po-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Lines</h2>
            {available.length > 0 && (
              <Select value="" onValueChange={addLine}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Add a product…" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.inventory} in stock)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Add the products you are ordering.
            </p>
          ) : (
            lines.map((line, index) => {
              const product = productsById.get(line.productId)
              return (
                <div key={line.productId} className="flex flex-wrap items-end gap-3 rounded-md border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product?.sku} · {product?.inventory} in stock, low at{' '}
                      {product?.lowStockThreshold}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`qty-${line.productId}`}>
                      Quantity
                    </Label>
                    <Input
                      id={`qty-${line.productId}`}
                      type="number"
                      min={1}
                      className="w-24"
                      value={line.quantityOrdered}
                      onChange={(e) => {
                        const value = Math.max(1, Math.trunc(Number(e.target.value) || 1))
                        setLines((prev) =>
                          prev.map((l, i) => (i === index ? { ...l, quantityOrdered: value } : l))
                        )
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`cost-${line.productId}`}>
                      Unit cost
                    </Label>
                    <Input
                      id={`cost-${line.productId}`}
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28"
                      value={line.unitCost}
                      onChange={(e) => {
                        const value = Math.max(0, Number(e.target.value) || 0)
                        setLines((prev) =>
                          prev.map((l, i) => (i === index ? { ...l, unitCost: value } : l))
                        )
                      }}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              )
            })
          )}

          {lines.length > 0 && (
            <dl className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">${subtotal.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">${total.toFixed(2)}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => submit(true)} disabled={!canSave || isSaving}>
          {isSaving ? 'Saving…' : 'Create and submit'}
        </Button>
        <Button variant="outline" onClick={() => submit(false)} disabled={!canSave || isSaving}>
          Save as draft
        </Button>
        <Button variant="ghost" onClick={() => router.push('/admin/purchase-orders')} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
