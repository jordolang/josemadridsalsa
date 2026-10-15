'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SMS_CONSENT_TEXT } from '@/lib/order-tracking/lookup'

interface SmsAlertsFormProps {
  orderNumber: string
  token: string
  alreadySubscribed: boolean
}

/** Opt in to text alerts for this order. */
export function SmsAlertsForm({ orderNumber, token, alreadySubscribed }: SmsAlertsFormProps) {
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [done, setDone] = useState(alreadySubscribed)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (done) {
    return (
      <p className="text-sm">
        You&apos;re signed up. We&apos;ll text you when your order&apos;s status changes. Reply STOP
        to any message to cancel.
      </p>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/order-tracking/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, token, phone, consent }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(result.error ?? 'Something went wrong. Please try again.')
        return
      }
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sms-phone">Mobile number</Label>
        <Input
          id="sms-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(740) 555-1234"
          required
        />
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="sms-consent"
          checked={consent}
          onCheckedChange={(value) => setConsent(value === true)}
          className="mt-0.5"
        />
        <Label htmlFor="sms-consent" className="text-sm leading-snug font-normal text-muted-foreground">
          {SMS_CONSENT_TEXT}
        </Label>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading || !consent}>
        {loading ? 'Signing up…' : 'Text me updates'}
      </Button>
    </form>
  )
}
