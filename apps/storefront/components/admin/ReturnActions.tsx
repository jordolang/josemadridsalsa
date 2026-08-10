'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { ReturnItemCondition, ReturnResolution, ReturnStatus } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RETURN_STATUS_LABELS, nextReturnStatuses } from '@/lib/orders/returns'

export interface ReturnActionItem {
  id: string
  productName: string
  quantity: number
  condition: ReturnItemCondition | null
}

const CONDITION_LABELS: Record<ReturnItemCondition, string> = {
  RESELLABLE: 'Resellable — back to stock',
  DAMAGED: 'Damaged — not restocked',
  DISCARDED: 'Discarded',
}

/**
 * Moves a return through its lifecycle.
 *
 * Only the transitions the state machine actually allows are offered, so the UI cannot ask
 * the API for something it will refuse. Condition is captured on the way to RECEIVED,
 * because that is what decides restocking when the return is later completed.
 */
/** What completing the return will actually do about the money, so it is not a surprise. */
const RESOLUTION_EFFECT: Record<ReturnResolution, string> = {
  REFUND: 'refund the value to the original payment method',
  STORE_CREDIT: 'issue a gift certificate for the value',
  EXCHANGE: 'raise a replacement order for the returned items',
}

const RESOLUTION_LABELS: Record<ReturnResolution, string> = {
  REFUND: 'Refund — money back',
  STORE_CREDIT: 'Store credit — gift certificate',
  EXCHANGE: 'Exchange — send replacements',
}

export function ReturnActions({
  returnId,
  status,
  items,
  restockingFee,
  resolution,
  refundValueCents,
}: {
  returnId: string
  status: ReturnStatus
  items: ReturnActionItem[]
  restockingFee: number | null
  resolution: ReturnResolution
  /** Value at stake, so staff see the number before pressing the button. */
  refundValueCents: number
}) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [adminNote, setAdminNote] = useState('')
  const [fee, setFee] = useState(restockingFee?.toString() ?? '')
  // `refundValueCents` already has the saved fee deducted; adding it back gives the goods value,
  // against which the fee currently typed in the box can be applied.
  const savedFeeCents = Math.round((restockingFee ?? 0) * 100)
  // Customer-raised returns arrive as REFUND, so this is where staff decide otherwise.
  const [chosenResolution, setChosenResolution] = useState<ReturnResolution>(resolution)
  const [conditions, setConditions] = useState<Record<string, ReturnItemCondition>>(
    Object.fromEntries(
      items.filter((i) => i.condition).map((i) => [i.id, i.condition as ReturnItemCondition])
    )
  )

  const available = nextReturnStatuses(status)
  if (available.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This return is {RETURN_STATUS_LABELS[status].toLowerCase()} — no further action.
      </p>
    )
  }

  const needsInspection = available.includes('RECEIVED')
  const allInspected = items.every((item) => conditions[item.id])

  // Recomputed from the fee currently in the box, not the saved one, so the figure shown tracks
  // what the button will actually do.
  const feeCents = Math.max(0, Math.round(Number(fee || 0) * 100))
  const pendingValueCents = Math.max(0, refundValueCents + savedFeeCents - feeCents)

  async function advance(next: ReturnStatus) {
    if (next === 'RECEIVED' && !allInspected) {
      toast.error('Record a condition for every item first')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/returns/${returnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: next,
          adminNote: adminNote.trim() || undefined,
          restockingFee: fee.trim() ? Number(fee) : undefined,
          resolution: chosenResolution !== resolution ? chosenResolution : undefined,
          itemConditions:
            next === 'RECEIVED'
              ? items.map((item) => ({
                  returnRequestItemId: item.id,
                  condition: conditions[item.id],
                }))
              : undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? 'Failed to update return')
        return
      }

      // Completion is the step that moves money, so the toast says what actually happened to it
      // rather than just that the status changed.
      const settlement = data.settlement as
        | { outcome: string; storeCreditCode?: string | null; exchangeOrderNumber?: string | null }
        | null

      if (next === 'COMPLETED' && settlement) {
        toast.success(
          settlement.outcome === 'REFUND'
            ? 'Completed — refund sent'
            : settlement.outcome === 'STORE_CREDIT'
              ? `Completed — credit ${settlement.storeCreditCode} issued`
              : `Completed — replacement order ${settlement.exchangeOrderNumber} raised`
        )
      } else {
        toast.success(
          next === 'COMPLETED' && data.restocked?.length
            ? `Completed — ${data.restocked.length} line(s) processed`
            : `Return ${RETURN_STATUS_LABELS[next].toLowerCase()}`
        )
      }
      router.refresh()
    } catch {
      toast.error('Failed to update return')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {needsInspection && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Inspection</p>
          <p className="text-xs text-muted-foreground">
            Condition decides restocking. Only resellable units go back into sellable stock.
          </p>
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm">
                {item.productName} × {item.quantity}
              </span>
              <Select
                value={conditions[item.id] ?? ''}
                onValueChange={(v) =>
                  setConditions((prev) => ({ ...prev, [item.id]: v as ReturnItemCondition }))
                }
              >
                <SelectTrigger className="w-56" aria-label={`Condition for ${item.productName}`}>
                  <SelectValue placeholder="Condition…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      {available.includes('COMPLETED') && (
        <>
          <div className="space-y-1">
            <Label htmlFor="restocking-fee" className="text-xs">
              Restocking fee (optional)
            </Label>
            <Input
              id="restocking-fee"
              type="number"
              min={0}
              step="0.01"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="0.00"
              className="w-40"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Resolution</Label>
            <Select
              value={chosenResolution}
              onValueChange={(v) => setChosenResolution(v as ReturnResolution)}
            >
              <SelectTrigger className="w-72" aria-label="Resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RESOLUTION_LABELS) as ReturnResolution[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {RESOLUTION_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            Completing this return will{' '}
            <span className="font-medium">{RESOLUTION_EFFECT[chosenResolution]}</span> —{' '}
            <span className="tabular-nums">${(pendingValueCents / 100).toFixed(2)}</span>
            {feeCents > 0 && (
              <span className="text-muted-foreground">
                {' '}
                (after a ${(feeCents / 100).toFixed(2)} restocking fee)
              </span>
            )}
            . This cannot be undone from here.
          </div>
        </>
      )}

      <div className="space-y-1">
        <Label htmlFor="return-admin-note" className="text-xs">
          Internal note (optional)
        </Label>
        <Textarea
          id="return-admin-note"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={2}
          placeholder="Why this decision was made…"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {available.map((next) => (
          <Button
            key={next}
            variant={next === 'REJECTED' || next === 'CANCELLED' ? 'outline' : 'default'}
            disabled={isSaving}
            onClick={() => advance(next)}
          >
            {next === 'RECEIVED' ? 'Mark received' : RETURN_STATUS_LABELS[next]}
          </Button>
        ))}
      </div>
    </div>
  )
}
