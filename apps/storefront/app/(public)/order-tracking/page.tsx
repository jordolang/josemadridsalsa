import type { Metadata } from 'next'
import { createMetadata } from '@/lib/metadata'
import { Card } from '@/components/ui/card'
import { OrderLookupForm } from '@/components/order-tracking/OrderLookupForm'

export const metadata: Metadata = createMetadata({
  title: 'Track Your Order',
  description:
    'Check the status of your Jose Madrid Salsa order with your order number and phone, or a tracking number.',
  pathname: '/order-tracking',
})

/** Public entry point for order tracking: look up an order, then see its full history. */
export default function OrderTrackingPage() {
  return (
    <main className="container mx-auto max-w-xl px-4 py-16">
      <h1 className="font-serif text-4xl font-bold">Track your order</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        See where your salsa is, from the moment we get your order to the moment it reaches your
        door.
      </p>
      <Card className="mt-8 p-6">
        <OrderLookupForm />
      </Card>
    </main>
  )
}
