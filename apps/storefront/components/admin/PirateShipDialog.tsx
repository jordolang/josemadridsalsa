'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Info, Ship } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Parcel {
  weightLb: number
  weightOz: number
  lengthIn: number
  widthIn: number
  heightIn: number
}

interface Verification {
  status: 'verified' | 'warning' | 'failed' | 'skipped'
  messages: string[]
}

interface PirateShipDialogProps {
  orderId: string
  orderNumber: string
  hasShippingAddress: boolean
}

const VERIFICATION_UI: Record<
  Verification['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }
> = {
  verified: { label: 'Address verified', variant: 'default', icon: CheckCircle2 },
  warning: { label: 'Address adjusted', variant: 'secondary', icon: AlertTriangle },
  failed: { label: 'Address not verified', variant: 'destructive', icon: AlertTriangle },
  skipped: { label: 'Verification skipped', variant: 'outline', icon: Info },
}

export default function PirateShipDialog({
  orderId,
  orderNumber,
  hasShippingAddress,
}: PirateShipDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [parcel, setParcel] = useState<Parcel | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [error, setError] = useState('')

  const loadPreview = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/pirate-ship`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load shipping preview')
      setParcel({
        weightLb: data.parcel.weightLb,
        weightOz: data.parcel.weightOz,
        lengthIn: data.parcel.lengthIn,
        widthIn: data.parcel.widthIn,
        heightIn: data.parcel.heightIn,
      })
      setVerification(data.verification)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && !parcel) void loadPreview()
  }

  const setField = (field: keyof Parcel, value: string) => {
    const parsed = Number(value)
    setParcel((prev) =>
      prev ? { ...prev, [field]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 } : prev
    )
  }

  const handleDownload = () => {
    if (!parcel) return
    const qs = new URLSearchParams({
      download: '1',
      weightLb: String(parcel.weightLb),
      weightOz: String(parcel.weightOz),
      lengthIn: String(parcel.lengthIn),
      widthIn: String(parcel.widthIn),
      heightIn: String(parcel.heightIn),
    })
    const a = document.createElement('a')
    a.href = `/api/admin/orders/${orderId}/pirate-ship?${qs.toString()}`
    a.download = `pirateship-${orderNumber}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    toast.success('Pirate Ship file downloaded', {
      description: 'Drag it into pirateship.com, then buy & print the label.',
    })
  }

  const vui = verification ? VERIFICATION_UI[verification.status] : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={!hasShippingAddress}>
          <Ship className="mr-2 size-4" />
          Export to Pirate Ship
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export to Pirate Ship</DialogTitle>
          <DialogDescription>
            Review the parcel for order {orderNumber}, then download the import file to
            drag into pirateship.com.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading && (
            <p className="text-sm text-muted-foreground">Calculating parcel…</p>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {vui && verification && (
            <div className="space-y-2">
              <Badge variant={vui.variant} className="gap-1">
                <vui.icon className="size-3.5" />
                {vui.label}
              </Badge>
              {verification.messages.length > 0 && (
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {verification.messages.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {parcel && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="weightLb">Weight (lb)</Label>
                  <Input
                    id="weightLb"
                    type="number"
                    min={0}
                    value={parcel.weightLb}
                    onChange={(e) => setField('weightLb', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="weightOz">Weight (oz)</Label>
                  <Input
                    id="weightOz"
                    type="number"
                    min={0}
                    value={parcel.weightOz}
                    onChange={(e) => setField('weightOz', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="lengthIn">Length (in)</Label>
                  <Input
                    id="lengthIn"
                    type="number"
                    min={0}
                    value={parcel.lengthIn}
                    onChange={(e) => setField('lengthIn', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="widthIn">Width (in)</Label>
                  <Input
                    id="widthIn"
                    type="number"
                    min={0}
                    value={parcel.widthIn}
                    onChange={(e) => setField('widthIn', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="heightIn">Height (in)</Label>
                  <Input
                    id="heightIn"
                    type="number"
                    min={0}
                    value={parcel.heightIn}
                    onChange={(e) => setField('heightIn', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button type="button" onClick={handleDownload} disabled={!parcel || loading}>
            <Download className="mr-2 size-4" />
            Download Pirate Ship file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
