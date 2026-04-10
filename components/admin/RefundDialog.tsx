'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Info } from 'lucide-react'
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

interface RefundDialogProps {
  orderId: string
  orderNumber: string
  totalPaid: number
  refundableAmount: number
  paymentStatus: string
}

export default function RefundDialog({
  orderId,
  orderNumber,
  totalPaid,
  refundableAmount,
  paymentStatus,
}: RefundDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  const canRefund =
    (paymentStatus === 'PAID' || paymentStatus === 'PARTIALLY_REFUNDED') &&
    refundableAmount > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsProcessing(true)

    try {
      const refundAmount = parseFloat(amount)

      // Validate amount
      if (isNaN(refundAmount) || refundAmount <= 0) {
        throw new Error('Refund amount must be a positive number')
      }

      if (refundAmount > refundableAmount) {
        throw new Error(
          `Refund amount cannot exceed refundable amount ($${refundableAmount.toFixed(2)})`
        )
      }

      const response = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: refundAmount }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process refund')
      }

      toast.success('Refund processed', {
        description: `$${refundAmount.toFixed(2)} refunded for ${orderNumber}.`,
      })
      setOpen(false)
      setAmount('')
      router.refresh()
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow empty string, numbers, and decimal points
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
      setError('')
    }
  }

  const setFullRefund = () => {
    setAmount(refundableAmount.toFixed(2))
    setError('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={!canRefund}>
          <DollarSign className="mr-2 size-4" />
          Process Refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Issue a refund for order {orderNumber} through Stripe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2 rounded-lg bg-muted p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-medium tabular-nums">
                  ${totalPaid.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Refundable Amount</span>
                <span className="font-medium tabular-nums">
                  ${refundableAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">
                Refund Amount <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="amount"
                    type="text"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0.00"
                    className="pl-7"
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={setFullRefund}
                >
                  Full Refund
                </Button>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <Alert>
              <Info className="size-4" />
              <AlertDescription>
                This action will create a refund in Stripe. The order status
                will update automatically via webhook.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isProcessing || !amount}>
              {isProcessing ? 'Processing...' : 'Process Refund'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
