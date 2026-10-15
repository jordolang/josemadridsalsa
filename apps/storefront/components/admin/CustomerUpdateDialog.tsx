'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquarePlus } from 'lucide-react'
import { toast } from 'sonner'
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
import { Textarea } from '@/components/ui/textarea'

interface CustomerUpdateDialogProps {
  orderId: string
  orderNumber: string
}

/** Post a note or delay to the customer's order-tracking page. */
export function CustomerUpdateDialog({ orderId, orderNumber }: CustomerUpdateDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'NOTE' | 'DELAY'>('NOTE')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/customer-updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(result.error ?? 'Failed to post update')
        return
      }
      toast.success('Update posted', { description: `The customer can see it on ${orderNumber}'s tracking page.` })
      setMessage('')
      setKind('NOTE')
      setOpen(false)
      router.refresh()
    } catch {
      setError('Failed to post update')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <MessageSquarePlus className="mr-2 size-4" />
          Post Customer Update
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Post a customer update</DialogTitle>
            <DialogDescription>
              The customer sees this on the tracking page for order {orderNumber}. Admin notes stay
              private; this does not.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-update-kind">Type</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as 'NOTE' | 'DELAY')}>
                <SelectTrigger id="customer-update-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTE">Note</SelectItem>
                  <SelectItem value="DELAY">Delay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-update-message">Message</Label>
              <Textarea
                id="customer-update-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="We're at an event in Columbus this weekend; your order ships Monday."
                required
              />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !message.trim()}>
              {loading ? 'Posting…' : 'Post update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
