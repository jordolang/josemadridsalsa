'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ExternalLink, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface PurchasedReturnLabel {
  url: string | null
  trackingCode: string | null
  carrier: string | null
  service: string | null
  costCents: number | null
  purchasedAt: Date | null
}

/**
 * Buys and shows the prepaid label the customer uses to send goods back.
 *
 * The button is deliberately explicit that money is spent — a return label is a real carrier
 * purchase, unlike most admin actions — and it disappears once a label exists, because buying a
 * second one charges again for a parcel that only needs one.
 */
export function ReturnLabelPanel({
  returnId,
  label,
  canWrite,
  isTerminal,
}: {
  returnId: string
  label: PurchasedReturnLabel
  canWrite: boolean
  isTerminal: boolean
}) {
  const router = useRouter()
  const [isBuying, setIsBuying] = useState(false)

  async function buyLabel() {
    setIsBuying(true)
    try {
      const response = await fetch(`/api/admin/returns/${returnId}/return-label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? 'Could not buy a return label')
        return
      }

      toast.success('Return label bought')
      router.refresh()
    } catch {
      toast.error('Could not buy a return label')
    } finally {
      setIsBuying(false)
    }
  }

  if (label.trackingCode) {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">
            {label.carrier ?? 'Carrier'} {label.service ?? ''}
          </span>
          {label.costCents !== null && (
            <span className="text-muted-foreground tabular-nums">
              ${(label.costCents / 100).toFixed(2)}
            </span>
          )}
        </div>
        <p className="font-mono text-xs text-muted-foreground">{label.trackingCode}</p>
        {label.url && (
          <Button variant="outline" size="sm" asChild>
            <a href={label.url} target="_blank" rel="noopener noreferrer">
              Open label
              <ExternalLink className="ml-1 size-3.5" />
            </a>
          </Button>
        )}
        {label.purchasedAt && (
          <p className="text-xs text-muted-foreground">
            Bought {label.purchasedAt.toLocaleString()}
          </p>
        )}
      </div>
    )
  }

  if (isTerminal) {
    return (
      <p className="text-sm text-muted-foreground">
        This return is finished, so a label would never be used.
      </p>
    )
  }

  if (!canWrite) {
    return <p className="text-sm text-muted-foreground">No return label bought.</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Buys the cheapest available label from the customer&rsquo;s address back to the warehouse.
        This charges the carrier account.
      </p>
      <Button size="sm" disabled={isBuying} onClick={buyLabel}>
        {isBuying && <Loader2 className="mr-1 size-4 animate-spin" />}
        Buy return label
      </Button>
    </div>
  )
}
