'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Method = 'order' | 'tracking'

/** Look up an order by order number + phone, or by a carrier tracking number. */
export function OrderLookupForm() {
  const router = useRouter()
  const [method, setMethod] = useState<Method>('order')
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const body =
      method === 'order' ? { method, orderNumber, phone } : { method, trackingNumber }

    try {
      const response = await fetch('/api/order-tracking/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !result.url) {
        setError(result.error ?? 'Something went wrong. Please try again.')
        return
      }
      router.push(result.url)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs value={method} onValueChange={(value) => setMethod(value as Method)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="order">Order number</TabsTrigger>
          <TabsTrigger value="tracking">Tracking number</TabsTrigger>
        </TabsList>

        <TabsContent value="order" className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="order-number">Order number</Label>
            <Input
              id="order-number"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="JMS-12345"
              autoComplete="off"
              required={method === 'order'}
            />
            <p className="text-sm text-muted-foreground">
              It&apos;s in your confirmation email and starts with JMS-.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-phone">Phone number on the order</Label>
            <Input
              id="order-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(740) 555-1234"
              autoComplete="tel"
              required={method === 'order'}
            />
          </div>
        </TabsContent>

        <TabsContent value="tracking" className="mt-6 space-y-2">
          <Label htmlFor="tracking-number">Tracking number</Label>
          <Input
            id="tracking-number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="9400 1000 0000 0000 0000 00"
            autoComplete="off"
            required={method === 'tracking'}
          />
          <p className="text-sm text-muted-foreground">
            A tracking number shows the shipment only. Use your order number and phone to see
            everything about your order.
          </p>
        </TabsContent>
      </Tabs>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Looking up…' : 'Track my order'}
      </Button>
    </form>
  )
}
