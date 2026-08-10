'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Textarea } from '@/components/ui/textarea'

export interface ReceivableItem {
  id: string
  productName: string
  productSku: string
  quantityOrdered: number
  quantityReceived: number
}

/**
 * Records a delivery against a purchase order.
 *
 * Quantities default to what is still outstanding rather than to zero. This is the opposite
 * of the customer return form, and deliberately so: a return is a choice about what to send
 * back, whereas a delivery usually *is* the rest of the order, and making someone retype
 * numbers off a packing slip they have already checked invites transcription errors. The
 * "Receive all" shortcut exists for the same reason.
 *
 * The inputs cap at what is outstanding because the server refuses over-receipt outright —
 * better to make the limit visible here than to let someone type 20, submit, and be told no.
 */
export function ReceiveItemsDialog({
  purchaseOrderId,
  poNumber,
  items,
}: {
  purchaseOrderId: string
  poNumber: string
  items: ReceivableItem[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const outstanding = useMemo(
    () =>
      items
        .map((item) => ({ ...item, remaining: item.quantityOrdered - item.quantityReceived }))
        .filter((item) => item.remaining > 0),
    [items]
  )

  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      items
        .map((item) => [item.id, item.quantityOrdered - item.quantityReceived] as const)
        .filter(([, remaining]) => remaining > 0)
    )
  )

  const totalReceiving = Object.values(quantities).reduce((sum, qty) => sum + qty, 0)

  async function submit() {
    setIsSaving(true)
    try {
      const response = await fetch(
        `/api/admin/purchase-orders/${purchaseOrderId}/receipts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lines: Object.entries(quantities).map(([purchaseOrderItemId, quantity]) => ({
              purchaseOrderItemId,
              quantity,
            })),
            reference: reference.trim() || undefined,
            notes: notes.trim() || undefined,
          }),
        }
      )

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? 'Could not record the receipt')
        return
      }

      toast.success(
        data.status === 'RECEIVED'
          ? `${poNumber} received in full — stock updated`
          : `Receipt recorded — ${poNumber} is partially received`
      )
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Could not record the receipt')
    } finally {
      setIsSaving(false)
    }
  }

  if (outstanding.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Receive stock</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive stock on {poNumber}</DialogTitle>
          <DialogDescription>
            Enter what actually arrived. Receiving adds it to sellable stock and records an
            inventory movement against this purchase order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setQuantities(
                  Object.fromEntries(outstanding.map((item) => [item.id, item.remaining]))
                )
              }
            >
              Receive all
            </Button>
          </div>

          {outstanding.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-md border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.productSku} · {item.remaining} outstanding of {item.quantityOrdered}
                </p>
              </div>
              <Input
                type="number"
                min={0}
                max={item.remaining}
                value={quantities[item.id] ?? 0}
                aria-label={`Quantity received for ${item.productName}`}
                onChange={(e) => {
                  const raw = Number(e.target.value)
                  const clamped = Number.isFinite(raw)
                    ? Math.max(0, Math.min(item.remaining, Math.trunc(raw)))
                    : 0
                  setQuantities((prev) => ({ ...prev, [item.id]: clamped }))
                }}
                className="w-24"
              />
            </div>
          ))}

          <div className="space-y-1">
            <Label htmlFor="receipt-reference">Packing slip or invoice number (optional)</Label>
            <Input
              id="receipt-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. PS-40219"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="receipt-notes">Notes (optional)</Label>
            <Textarea
              id="receipt-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything unusual about this delivery…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isSaving || totalReceiving === 0}>
            {isSaving ? 'Recording…' : `Receive ${totalReceiving} item${totalReceiving === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
