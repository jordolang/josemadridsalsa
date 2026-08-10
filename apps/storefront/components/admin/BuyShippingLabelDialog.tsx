'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Tag } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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

interface ShippingRate {
  id: string
  carrier: string
  service: string
  rate: number
  deliveryDays?: number | null
}

interface RateQuote {
  parcel: { length: number; width: number; height: number; weight: number }
  packing: string
  customerPaidShipping: number
  testMode: boolean
  rates: ShippingRate[]
  messages: Array<{ type: string; message: string }>
}

interface BuyShippingLabelDialogProps {
  orderId: string
  orderNumber: string
  hasShippingAddress: boolean
}

/**
 * Buys real postage.
 *
 * This dialog used to **make up the rates it displayed** — a `mockRates` array built client-side
 * from a hard-coded service list and an invented price — and the endpoint behind it never called
 * the carrier either. Now the rates come from the carrier for this order's actual parcel, and the
 * primary action is one click on the cheapest one, which is the only step that should need a human.
 */
export default function BuyShippingLabelDialog({
  orderId,
  orderNumber,
  hasShippingAddress,
}: BuyShippingLabelDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [quote, setQuote] = useState<RateQuote | null>(null)
  const [chosenRateId, setChosenRateId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    trackingNumber: string
    cost: number
    carrier: string
    service: string
    labelUrl?: string
  } | null>(null)

  const loadRates = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/shipping-label/rates`)
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Could not fetch rates')
        return
      }
      setQuote(data)
      // Cheapest pre-selected: the endpoint returns them sorted, so the default is one click away.
      setChosenRateId(data.rates[0]?.id ?? null)
    } catch {
      setError('Could not fetch rates')
    } finally {
      setIsLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    if (open && !quote && !result) {
      loadRates()
    }
  }, [open, quote, result, loadRates])

  async function purchase() {
    if (!chosenRateId) return
    setIsPurchasing(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/shipping-label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rateId: chosenRateId }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Failed to buy the label')
        return
      }
      setResult(data.label)
      toast.success('Label bought', {
        description: `${data.label.carrier} ${data.label.service} — ${data.label.trackingNumber}`,
      })
      router.refresh()
    } catch {
      setError('Failed to buy the label')
    } finally {
      setIsPurchasing(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setQuote(null)
      setChosenRateId(null)
      setError(null)
      setResult(null)
    }
  }

  if (!hasShippingAddress) {
    return null
  }

  const chosen = quote?.rates.find((rate) => rate.id === chosenRateId) ?? null
  // A label costing more than the customer paid is not a reason to block, but it is a reason to say
  // so before the money goes — that is the case where Pirate Ship is worth the manual detour.
  const underwater = chosen !== null && quote !== null && chosen.rate > quote.customerPaidShipping

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          <Tag className="size-4" />
          Buy Shipping Label
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buy shipping label</DialogTitle>
          <DialogDescription>
            Real carrier rates for order {orderNumber}. Buying charges the carrier account.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="size-5 text-emerald-600" />
              {result.carrier} {result.service} — ${result.cost.toFixed(2)}
            </div>
            <p className="font-mono text-xs text-muted-foreground">{result.trackingNumber}</p>
            {result.labelUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={result.labelUrl} target="_blank" rel="noopener noreferrer">
                  Print label
                  <ExternalLink className="ml-1 size-3.5" />
                </a>
              </Button>
            )}
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Pricing this parcel with the carrier…
          </div>
        ) : quote ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{quote.packing}</p>
              <p className="text-xs text-muted-foreground">
                {quote.parcel.length}″ × {quote.parcel.width}″ × {quote.parcel.height}″ ·{' '}
                {(quote.parcel.weight / 16).toFixed(1)} lb · customer paid $
                {quote.customerPaidShipping.toFixed(2)}
              </p>
            </div>

            {quote.testMode && (
              <Alert>
                <AlertDescription className="text-xs">
                  Carrier is in test mode — no real postage will be bought.
                </AlertDescription>
              </Alert>
            )}

            {quote.rates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No carrier returned a rate for this parcel.
                {quote.messages.map((m) => ` ${m.message}`)}
              </p>
            ) : (
              <div className="space-y-1">
                {quote.rates.map((rate, index) => (
                  <button
                    key={rate.id}
                    type="button"
                    onClick={() => setChosenRateId(rate.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                      rate.id === chosenRateId
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <span>
                      <span className="font-medium">
                        {rate.carrier} {rate.service}
                      </span>
                      {rate.deliveryDays ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {rate.deliveryDays} day{rate.deliveryDays === 1 ? '' : 's'}
                        </span>
                      ) : null}
                      {index === 0 && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          cheapest
                        </Badge>
                      )}
                    </span>
                    <span className="tabular-nums font-medium">${rate.rate.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}

            {underwater && chosen && (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertDescription className="text-xs">
                  This label costs ${(chosen.rate - quote.customerPaidShipping).toFixed(2)} more than
                  the customer paid for shipping. Consider buying it through Pirate Ship and
                  recording it manually instead.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : null}

        <DialogFooter>
          {result ? (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={!chosenRateId || isPurchasing} onClick={purchase}>
                {isPurchasing && <Loader2 className="mr-1 size-4 animate-spin" />}
                {chosen ? `Buy for $${chosen.rate.toFixed(2)}` : 'Buy label'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
