'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PackageCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface FulfillableItem {
  id: string
  productName: string
  productSku: string
  quantity: number
  quantityFulfilled: number
}

/**
 * Records a shipment covering part (or all) of an order.
 *
 * Quantities default to everything still outstanding, so the common case — "this box has
 * the rest of the order in it" — is one click, while a genuine split shipment just means
 * editing the numbers down.
 */
export function FulfillItemsDialog({
  orderId,
  items,
}: {
  orderId: string
  items: FulfillableItem[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [carrierName, setCarrierName] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')

  const outstanding = useMemo(
    () =>
      items
        .map((item) => ({ ...item, remaining: Math.max(0, item.quantity - item.quantityFulfilled) }))
        .filter((item) => item.remaining > 0),
    [items]
  )

  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const valueFor = (itemId: string, remaining: number) => quantities[itemId] ?? remaining

  const totalUnits = outstanding.reduce(
    (sum, item) => sum + valueFor(item.id, item.remaining),
    0
  )

  if (outstanding.length === 0) return null

  async function handleSubmit() {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/fulfillments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: outstanding
            .map((item) => ({ orderItemId: item.id, quantity: valueFor(item.id, item.remaining) }))
            .filter((line) => line.quantity > 0),
          carrierName: carrierName.trim() || undefined,
          trackingNumber: trackingNumber.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? 'Failed to record fulfillment')
        return
      }

      toast.success(
        data.fulfillmentStatus === 'FULFILLED'
          ? 'Order fully fulfilled'
          : 'Partial shipment recorded'
      )
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Failed to record fulfillment')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PackageCheck className="mr-2 size-4" />
          Fulfill items
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record a shipment</DialogTitle>
          <DialogDescription>
            Enter what is actually going in this box. Anything left over stays outstanding and
            can be shipped separately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {outstanding.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.productSku} · {item.remaining} of {item.quantity} outstanding
                </p>
              </div>
              <Input
                type="number"
                min={0}
                max={item.remaining}
                aria-label={`Quantity to fulfill for ${item.productName}`}
                value={valueFor(item.id, item.remaining)}
                onChange={(e) => {
                  const raw = Number(e.target.value)
                  const clamped = Number.isFinite(raw)
                    ? Math.max(0, Math.min(item.remaining, Math.trunc(raw)))
                    : 0
                  setQuantities((prev) => ({ ...prev, [item.id]: clamped }))
                }}
                className="w-20"
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="fulfill-carrier" className="text-xs">
              Carrier (optional)
            </Label>
            <Input
              id="fulfill-carrier"
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              placeholder="USPS"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fulfill-tracking" className="text-xs">
              Tracking number (optional)
            </Label>
            <Input
              id="fulfill-tracking"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="1Z999…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || totalUnits === 0}>
            {isSaving ? 'Recording…' : `Fulfill ${totalUnits} item${totalUnits === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
