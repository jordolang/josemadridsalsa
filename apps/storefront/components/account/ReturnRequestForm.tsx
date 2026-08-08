'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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

export interface ReturnableItem {
  id: string
  productName: string
  productSku: string
  returnable: number
  unitPrice: number
}

const REASONS = [
  { value: 'DAMAGED', label: 'Arrived damaged' },
  { value: 'WRONG_ITEM', label: 'Wrong item sent' },
  { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
  { value: 'QUALITY_ISSUE', label: 'Quality issue' },
  { value: 'ARRIVED_LATE', label: 'Arrived too late' },
  { value: 'CHANGED_MIND', label: 'Changed my mind' },
  { value: 'OTHER', label: 'Something else' },
] as const

/**
 * Lets a customer ask to send something back.
 *
 * Quantities default to zero rather than the full amount — a return should be an explicit
 * choice of what is going back, not something submitted by reflex.
 */
export function ReturnRequestForm({
  orderId,
  orderNumber,
  items,
}: {
  orderId: string
  orderNumber: string
  items: ReturnableItem[]
}) {
  const router = useRouter()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [submitted, setSubmitted] = useState<{ rmaNumber: string } | null>(null)

  const selected = useMemo(
    () => Object.entries(quantities).filter(([, qty]) => qty > 0),
    [quantities]
  )

  const estimatedRefund = useMemo(
    () =>
      selected.reduce((sum, [id, qty]) => {
        const item = items.find((i) => i.id === id)
        return sum + (item ? item.unitPrice * qty : 0)
      }, 0),
    [selected, items]
  )

  if (submitted) {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-6">
        <h2 className="text-lg font-semibold">Return request received</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your reference is <span className="font-mono">{submitted.rmaNumber}</span>. We&apos;ll
          review it and email you with next steps — please hold on to the items until you hear
          from us.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(`/account/orders/${orderId}`)}
        >
          Back to order
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border p-6">
        <p className="text-sm text-muted-foreground">
          Nothing on this order can be returned right now. Items become returnable once
          they&apos;ve shipped, and returns are accepted within 30 days of despatch.
        </p>
      </div>
    )
  }

  async function submit() {
    setIsSaving(true)
    try {
      const response = await fetch('/api/account/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          reason,
          note: note.trim() || undefined,
          items: selected.map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? 'Could not submit your request')
        return
      }

      setSubmitted({ rmaNumber: data.returnRequest.rmaNumber })
    } catch {
      toast.error('Could not submit your request')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">What would you like to return?</h2>
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-md border p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.productName}</p>
              <p className="text-xs text-muted-foreground">
                {item.productSku} · up to {item.returnable} returnable
              </p>
            </div>
            <Input
              type="number"
              min={0}
              max={item.returnable}
              value={quantities[item.id] ?? 0}
              aria-label={`Quantity to return for ${item.productName}`}
              onChange={(e) => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw)
                  ? Math.max(0, Math.min(item.returnable, Math.trunc(raw)))
                  : 0
                setQuantities((prev) => ({ ...prev, [item.id]: clamped }))
              }}
              className="w-20"
            />
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label htmlFor="return-reason" className="text-sm font-semibold">
          Why are you returning it?
        </Label>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger id="return-reason" className="max-w-sm">
            <SelectValue placeholder="Choose a reason" />
          </SelectTrigger>
          <SelectContent>
            {REASONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="return-note" className="text-sm font-semibold">
          Anything else we should know? (optional)
        </Label>
        <Textarea
          id="return-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Tell us what went wrong…"
        />
      </div>

      {selected.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Estimated refund on approval:{' '}
          <span className="font-medium tabular-nums text-foreground">
            ${estimatedRefund.toFixed(2)}
          </span>
          . Final amount is confirmed once we receive and check the items.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={isSaving || selected.length === 0 || !reason}>
          {isSaving ? 'Submitting…' : `Request return for order ${orderNumber}`}
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push(`/account/orders/${orderId}`)}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
