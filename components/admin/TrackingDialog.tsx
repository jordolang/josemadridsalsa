'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Truck, ExternalLink } from 'lucide-react'
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
          carrier,
          trackingUrl: previewUrl || undefined,
          updateStatus: currentStatus !== 'SHIPPED' && currentStatus !== 'DELIVERED',
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save tracking info')
      }

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
          <Truck className="mr-2 h-4 w-4" />
          {currentTrackingNumber ? 'Update Tracking' : 'Add Tracking'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Shipment Tracking</DialogTitle>
            <DialogDescription>
              Add or update tracking info for order {orderNumber}
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
                Tracking Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="trackingNumber"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number..."
                required
              />
            </div>

            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Preview live tracking link
              </a>
            )}

            {currentStatus !== 'SHIPPED' && currentStatus !== 'DELIVERED' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm text-blue-800">
                  Order status will automatically be updated to <strong>Shipped</strong>.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
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
