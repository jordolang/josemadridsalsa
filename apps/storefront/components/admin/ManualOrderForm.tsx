'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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

interface ProductOption {
  id: string
  name: string
  sku: string
  price: number
  inventory: number
}

interface LineDraft {
  key: number
  productId: string
  quantity: string
  unitPrice: string
}

const CHANNELS = [
  { value: 'PHONE', label: 'Phone order' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'MANUAL', label: 'Manual / other' },
  { value: 'MARKETPLACE', label: 'Marketplace' },
]

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const num = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function ManualOrderForm({ products }: { products: ProductOption[] }) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [nextKey, setNextKey] = useState(1)
  const [lines, setLines] = useState<LineDraft[]>([
    { key: 0, productId: '', quantity: '1', unitPrice: '' },
  ])

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [salesChannel, setSalesChannel] = useState('PHONE')
  const [paymentStatus, setPaymentStatus] = useState('PAID')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [tax, setTax] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [notes, setNotes] = useState('')

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  )

  // Mirrors the server's arithmetic so the operator sees the figure before saving. The server
  // recomputes it regardless — this total is a preview, never the source.
  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => {
      const product = productById.get(line.productId)
      if (!product) return sum
      const unitPrice = line.unitPrice.trim() === '' ? product.price : num(line.unitPrice)
      return sum + unitPrice * num(line.quantity)
    }, 0)

    const discount = Math.min(num(discountAmount), subtotal)
    return {
      subtotal,
      discount,
      total: subtotal - discount + num(shippingCost) + num(tax),
    }
  }, [lines, productById, discountAmount, shippingCost, tax])

  const filledLines = lines.filter((line) => line.productId && num(line.quantity) > 0)
  const canSave = email.trim() !== '' && filledLines.length > 0 && !isSaving

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    )
  }

  async function save() {
    // The guard against a double submission. The server refuses an identical order created in
    // the last minute as well, because a slow response invites a second click.
    if (isSaving) return
    setIsSaving(true)

    try {
      const response = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            email: email.trim(),
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            phone: phone.trim() || undefined,
          },
          items: filledLines.map((line) => ({
            productId: line.productId,
            quantity: num(line.quantity),
            unitPrice: line.unitPrice.trim() === '' ? undefined : num(line.unitPrice),
          })),
          salesChannel,
          paymentStatus,
          paymentMethod: paymentMethod.trim() || undefined,
          shippingCost: num(shippingCost),
          tax: num(tax),
          discountAmount: num(discountAmount),
          notes: notes.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? 'Could not create the order')
        return
      }

      toast.success(`Order ${data.data?.orderNumber ?? ''} created`)
      router.push(`/admin/orders/${data.data.id}`)
      router.refresh()
    } catch {
      toast.error('Could not create the order')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Customer</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Items</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Leave the price blank to charge the catalogue price.
        </p>

        <div className="mt-4 space-y-3">
          {lines.map((line) => {
            const product = productById.get(line.productId)
            return (
              <div key={line.key} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <Label>Product</Label>
                  <Select
                    value={line.productId}
                    onValueChange={(productId) => updateLine(line.key, { productId })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a product…" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name} · {option.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                  />
                </div>
                <div className="w-28">
                  <Label>Unit price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                    placeholder={product ? product.price.toFixed(2) : '—'}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLines((c) => c.filter((l) => l.key !== line.key))}
                  disabled={lines.length === 1}
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {product && (
                  <span className="w-full text-xs text-muted-foreground sm:w-auto">
                    {product.inventory} in stock
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            setLines((c) => [...c, { key: nextKey, productId: '', quantity: '1', unitPrice: '' }])
            setNextKey((k) => k + 1)
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add line
        </Button>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Charges</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Entered, not calculated — this records what the customer was actually told.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="shippingCost">Shipping</Label>
            <Input
              id="shippingCost"
              type="number"
              step="0.01"
              min={0}
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="tax">Tax</Label>
            <Input
              id="tax"
              type="number"
              step="0.01"
              min={0}
              value={tax}
              onChange={(e) => setTax(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="discountAmount">Discount</Label>
            <Input
              id="discountAmount"
              type="number"
              step="0.01"
              min={0}
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <dl className="mt-6 space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{money(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular-nums">−{money(totals.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(totals.total)}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Channel and payment</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Sales channel</Label>
            <Select value={salesChannel} onValueChange={setSalesChannel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((channel) => (
                  <SelectItem key={channel.value} value={channel.value}>
                    {channel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment</Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="PENDING">Awaiting payment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="paymentMethod">Method</Label>
            <Input
              id="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="Cash, cheque #1234, invoice…"
            />
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anything worth remembering about this order"
          />
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/admin/orders')} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!canSave}>
          {isSaving ? 'Saving…' : `Create order · ${money(totals.total)}`}
        </Button>
      </div>
    </div>
  )
}
