'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Info, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CARRIERS = [
  { value: 'usps', label: 'USPS', trackingUrl: (n: string) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}` },
  { value: 'ups', label: 'UPS', trackingUrl: (n: string) => `https://www.ups.com/track?tracknum=${n}` },
  { value: 'fedex', label: 'FedEx', trackingUrl: (n: string) => `https://www.fedex.com/fedextrack/?trknbr=${n}` },
  { value: 'dhl', label: 'DHL', trackingUrl: (n: string) => `https://www.dhl.com/en/express/tracking.html?AWB=${n}` },
  { value: 'ontrac', label: 'OnTrac', trackingUrl: (n: string) => `https://www.ontrac.com/tracking/?number=${n}` },
  { value: 'other', label: 'Other', trackingUrl: () => '' },
]

interface TrackingDialogProps {
  orderId: string
  orderNumber: string
  currentTrackingNumber?: string | null
  currentStatus: string
}

export default function TrackingDialog({
  orderId,
  orderNumber,
  currentTrackingNumber,
  currentStatus,
}: TrackingDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState(currentTrackingNumber || '')
  const [carrier, setCarrier] = useState('usps')
  const [service, setService] = useState('')
  // What we paid the carrier. Kept as a string so an empty box stays empty rather than becoming 0,
  // which would record a free shipment.
  const [costPaid, setCostPaid] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedCarrier = CARRIERS.find((c) => c.value === carrier) ?? CARRIERS[0]
  const previewUrl =
    trackingNumber && carrier !== 'other'
      ? selectedCarrier.trackingUrl(trackingNumber.trim())
      : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: trackingNumber.trim(),
          carrier: selectedCarrier.label,
          service: service.trim() || undefined,
          costPaid: costPaid.trim() ? Number(costPaid) : undefined,
          trackingUrl: previewUrl || undefined,
          updateStatus: currentStatus !== 'SHIPPED' && currentStatus !== 'DELIVERED',
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save tracking info')
      }

      toast.success('Tracking saved', {
        description: costPaid.trim()
          ? `${orderNumber} — $${Number(costPaid).toFixed(2)} postage recorded.`
          : `Tracking attached to ${orderNumber}.`,
      })
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Truck className="mr-2 size-4" />
          {currentTrackingNumber ? 'Update Tracking' : 'Add Tracking'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record a shipment</DialogTitle>
            <DialogDescription>
              For postage bought outside the system — Pirate Ship, or over a counter. Paste what the
              carrier gave you for order {orderNumber}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier</Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger id="carrier">
                  <SelectValue />
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

            <div className="space-y-2">
              <Label htmlFor="trackingNumber">
                Tracking Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="trackingNumber"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="service">Service</Label>
                <Input
                  id="service"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="Ground Advantage"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPaid">Postage paid</Label>
                <Input
                  id="costPaid"
                  type="number"
                  min={0}
                  step="0.01"
                  value={costPaid}
                  onChange={(e) => setCostPaid(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Without this the shipment looks free and margin overstates every order it appears on. */}
            <p className="text-xs text-muted-foreground">
              Enter what you actually paid — through Pirate Ship or anywhere else. This is recorded
              against the order separately from what the customer was charged for shipping.
            </p>

            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" />
                Preview live tracking link
              </a>
            )}

            {currentStatus !== 'SHIPPED' && currentStatus !== 'DELIVERED' && (
              <Alert>
                <Info className="size-4" />
                <AlertDescription>
                  Order status will automatically update to{' '}
                  <strong>Shipped</strong>.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !trackingNumber.trim()}>
              {isLoading ? 'Saving...' : 'Save Tracking'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
