'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

/**
 * Submit or cancel a purchase order.
 *
 * Only the two transitions a person actually makes. Received states are derived from
 * quantities by the receiving path, so there is deliberately no control for them here — a
 * button that stamped `RECEIVED` would let the status disagree with the line items.
 */
export function PurchaseOrderActions({
  purchaseOrderId,
  status,
  hasItems,
}: {
  purchaseOrderId: string
  status: string
  hasItems: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState<'submit' | 'cancel' | null>(null)

  async function act(action: 'submit' | 'cancel') {
    if (action === 'cancel' && !confirmCancel()) return

    setPending(action)
    try {
      const response = await fetch(`/api/admin/purchase-orders/${purchaseOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? 'Could not update the purchase order')
        return
      }
      toast.success(action === 'submit' ? 'Purchase order submitted' : 'Purchase order cancelled')
      router.refresh()
    } catch {
      toast.error('Could not update the purchase order')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex gap-2">
      {status === 'DRAFT' && (
        <Button onClick={() => act('submit')} disabled={pending !== null || !hasItems}>
          {pending === 'submit' ? 'Submitting…' : 'Submit to supplier'}
        </Button>
      )}
      {(status === 'DRAFT' || status === 'SUBMITTED') && (
        <Button variant="outline" onClick={() => act('cancel')} disabled={pending !== null}>
          {pending === 'cancel' ? 'Cancelling…' : 'Cancel'}
        </Button>
      )}
    </div>
  )
}

/**
 * Browser dialogs block the page, so this is the one place we accept that cost: cancelling
 * is not undoable through the UI and is worth a deliberate second step.
 */
function confirmCancel(): boolean {
  return window.confirm(
    'Cancel this purchase order? This cannot be undone, and a cancelled order cannot be received against.'
  )
}
