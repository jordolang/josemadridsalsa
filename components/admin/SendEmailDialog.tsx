'use client'

import { useState } from 'react'
import { AlertTriangle, Mail } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'

const EMAIL_TYPES = [
  { value: 'confirmation', label: 'Order Confirmation', description: 'Resend the order confirmation email' },
  { value: 'shipping', label: 'Shipping Notification', description: 'Notify customer their order has shipped' },
  { value: 'custom', label: 'Custom Message', description: 'Send a custom message to the customer' },
] as const

type EmailType = typeof EMAIL_TYPES[number]['value']

interface SendEmailDialogProps {
  orderId: string
  orderNumber: string
  customerEmail: string
  trackingNumber?: string | null
}

export default function SendEmailDialog({
  orderId,
  orderNumber,
  customerEmail,
  trackingNumber,
}: SendEmailDialogProps) {
  const [open, setOpen] = useState(false)
  const [emailType, setEmailType] = useState<EmailType>('confirmation')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedType = EMAIL_TYPES.find((t) => t.value === emailType)!
  const isCustom = emailType === 'custom'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: emailType,
          subject: isCustom ? subject : undefined,
          message: isCustom ? message : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email')
      }

      toast.success('Email sent', {
        description: `${selectedType.label} sent to ${customerEmail}.`,
      })
      setOpen(false)
      setSubject('')
      setMessage('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (!value) {
      setError('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Mail className="mr-2 size-4" />
          Send Email
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>
              Send an email to {customerEmail} for order {orderNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="emailType">Email Type</Label>
              <Select value={emailType} onValueChange={(v) => setEmailType(v as EmailType)}>
                <SelectTrigger id="emailType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedType.description}
              </p>
            </div>

            {emailType === 'shipping' && !trackingNumber && (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  No tracking number found. Add tracking first for a better
                  shipping notification.
                </AlertDescription>
              </Alert>
            )}

            {isCustom && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="subject">
                    Subject <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject..."
                    required={isCustom}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">
                    Message <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here..."
                    rows={5}
                    required={isCustom}
                  />
                </div>
              </>
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
            <Button
              type="submit"
              disabled={isLoading || (isCustom && (!subject || !message))}
            >
              {isLoading ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
