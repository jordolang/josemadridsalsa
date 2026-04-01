'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tag } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ShippingRate {
  id: string
  carrier: string
  service: string
  rate: number
  deliveryDays?: number
}

interface BuyShippingLabelDialogProps {
  orderId: string
  orderNumber: string
  hasShippingAddress: boolean
}

const CARRIERS = [
  { value: 'usps', label: 'USPS' },
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
] as const

type Step = 'select' | 'confirm' | 'success'

export default function BuyShippingLabelDialog({
  orderId,
  orderNumber,
  hasShippingAddress,
}: BuyShippingLabelDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('select')
  const [carrier, setCarrier] = useState('')
  const [rates, setRates] = useState<ShippingRate[]>([])
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    trackingNumber: string
    cost: number
    carrier: string
    service: string
  } | null>(null)

  function resetState() {
    setStep('select')
    setCarrier('')
    setRates([])
    setSelectedRate(null)
    setError(null)
    setResult(null)
    setIsLoading(false)
    setIsPurchasing(false)
  }

  async function handleFetchRates() {
    if (!carrier) return

    setIsLoading(true)
    setError(null)
    setRates([])
    setSelectedRate(null)

    try {
      // The shipping label API fetches rates internally.
      // We can use the GET endpoint to check existing labels,
      // but for rate preview we'll use a lightweight approach:
      // fetch rates by attempting a calculate-shipping call or
      // just let the user pick carrier+service and show cost on confirm.
      //
      // Since the label POST endpoint validates rates internally,
      // we present common service options per carrier and show
      // the cost preview when they confirm.

      const serviceOptions = getServiceOptions(carrier)
      const mockRates: ShippingRate[] = serviceOptions.map((svc, i) => ({
        id: `rate-${carrier}-${i}`,
        carrier: carrier.toUpperCase(),
        service: svc.service,
        rate: svc.estimatedRate,
        deliveryDays: svc.deliveryDays,
      }))

      setRates(mockRates)

      if (mockRates.length > 0) {
        setSelectedRate(mockRates[0])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rates')
    } finally {
      setIsLoading(false)
    }
  }

  async function handlePurchase() {
    if (!selectedRate) return

    setIsPurchasing(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/shipping-label`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            carrier: carrier,
            service: selectedRate.service,
            rateId: selectedRate.id,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to purchase shipping label')
      }

      setResult({
        trackingNumber: data.label.trackingNumber,
        cost: data.label.cost,
        carrier: data.label.carrier,
        service: data.label.service,
      })
      setStep('success')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to purchase label')
    } finally {
      setIsPurchasing(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      resetState()
    }
  }

  if (!hasShippingAddress) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          <Tag className="h-4 w-4" />
          Buy Shipping Label
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buy Shipping Label</DialogTitle>
          <DialogDescription>
            Purchase a shipping label for order {orderNumber}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4 py-2">
            {/* Carrier selector */}
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Select value={carrier} onValueChange={(v) => { setCarrier(v); setRates([]); setSelectedRate(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  {CARRIERS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fetch rates button */}
            {carrier && rates.length === 0 && (
              <Button
                variant="outline"
                onClick={handleFetchRates}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Loading services...' : 'View Available Services'}
              </Button>
            )}

            {/* Service options */}
            {rates.length > 0 && (
              <div className="space-y-2">
                <Label>Service</Label>
                <div className="space-y-2">
                  {rates.map((rate) => (
                    <label
                      key={rate.id}
                      className={`flex items-center justify-between rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                        selectedRate?.id === rate.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shippingRate"
                          checked={selectedRate?.id === rate.id}
                          onChange={() => setSelectedRate(rate)}
                          className="h-4 w-4 text-blue-600"
                        />
                        <div>
                          <p className="text-sm font-medium">{rate.service}</p>
                          {rate.deliveryDays && (
                            <p className="text-xs text-slate-500">
                              {rate.deliveryDays} business days
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold">
                        ${rate.rate.toFixed(2)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        {step === 'success' && result && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-sm font-semibold text-green-800">
                Shipping label purchased successfully
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Carrier</span>
                <span className="font-medium">{result.carrier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Service</span>
                <span className="font-medium">{result.service}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Cost</span>
                <span className="font-medium">${result.cost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tracking</span>
                <span className="font-mono text-xs">{result.trackingNumber}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'select' && selectedRate && (
            <div className="flex w-full items-center justify-between">
              <div className="text-sm">
                <span className="text-slate-500">Cost: </span>
                <span className="font-semibold">${selectedRate.rate.toFixed(2)}</span>
              </div>
              <Button
                onClick={handlePurchase}
                disabled={isPurchasing}
              >
                {isPurchasing ? 'Purchasing...' : 'Confirm Purchase'}
              </Button>
            </div>
          )}
          {step === 'success' && (
            <Button onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function getServiceOptions(carrier: string): Array<{
  service: string
  estimatedRate: number
  deliveryDays: number
}> {
  switch (carrier) {
    case 'usps':
      return [
        { service: 'Ground Advantage', estimatedRate: 5.99, deliveryDays: 5 },
        { service: 'Priority Mail', estimatedRate: 8.99, deliveryDays: 3 },
        { service: 'Priority Mail Express', estimatedRate: 26.99, deliveryDays: 1 },
      ]
    case 'ups':
      return [
        { service: 'Ground', estimatedRate: 9.99, deliveryDays: 5 },
        { service: '3 Day Select', estimatedRate: 14.99, deliveryDays: 3 },
        { service: '2nd Day Air', estimatedRate: 22.99, deliveryDays: 2 },
        { service: 'Next Day Air', estimatedRate: 34.99, deliveryDays: 1 },
      ]
    case 'fedex':
      return [
        { service: 'Ground', estimatedRate: 9.49, deliveryDays: 5 },
        { service: 'Express Saver', estimatedRate: 15.99, deliveryDays: 3 },
        { service: '2Day', estimatedRate: 21.99, deliveryDays: 2 },
        { service: 'Priority Overnight', estimatedRate: 36.99, deliveryDays: 1 },
      ]
    default:
      return []
  }
}
