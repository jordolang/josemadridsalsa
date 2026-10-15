import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { verifyOrderAccessToken } from '@/lib/orders/access-token'
import { loadOrderTrackingView } from '@/lib/order-tracking/load'
import { statusLabel } from '@/lib/order-tracking/timeline'
import { smsAlertsEnabled } from '@/lib/order-tracking/sms'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { AutoRefresh } from '@/components/order-tracking/AutoRefresh'
import { CustomerTimeline, formatTrackingTime } from '@/components/order-tracking/CustomerTimeline'
import { ShipmentMap } from '@/components/order-tracking/ShipmentMap'
import { SmsAlertsForm } from '@/components/order-tracking/SmsAlertsForm'

export const dynamic = 'force-dynamic'

// A private page reached through a per-order link; keep it out of search results.
export const metadata: Metadata = {
  title: 'Your Order - Jose Madrid Salsa',
  robots: { index: false, follow: false },
}

type PageProps = {
  params: Promise<{ orderNumber: string }>
  searchParams: Promise<{ token?: string | string[] }>
}

export default async function OrderTrackingDetailPage({ params, searchParams }: PageProps) {
  const { orderNumber } = await params
  const { token: rawToken } = await searchParams
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken

  const order = await prisma.order.findFirst({
    where: { orderNumber: { equals: decodeURIComponent(orderNumber), mode: 'insensitive' } },
    select: { id: true },
  })
  // Same response for a wrong token and a missing order, so neither leaks which exists.
  if (!order || !token || !verifyOrderAccessToken(order.id, token)) notFound()

  const view = await loadOrderTrackingView(order.id)
  if (!view) notFound()

  const delivered = view.status === 'DELIVERED' || view.deliveredAt !== null
  const finished = delivered || view.status === 'CANCELLED' || view.status === 'REFUNDED'

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <AutoRefresh enabled={!finished} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold">Order {view.orderNumber}</h1>
          <p className="mt-1 text-muted-foreground">Placed {formatTrackingTime(view.placedAt)}</p>
        </div>
        <Badge className="text-sm">Status: {statusLabel(view.status)}</Badge>
      </div>

      {view.trackingNumber && (
        <Card className="mt-8 space-y-4 p-6">
          <h2 className="text-lg font-semibold">Shipment</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Carrier</dt>
              <dd className="font-medium">{view.carrierName ?? 'Carrier'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tracking number</dt>
              <dd className="font-medium break-all">{view.trackingNumber}</dd>
            </div>
            {view.estimatedDelivery && !delivered && (
              <div>
                <dt className="text-muted-foreground">Estimated delivery</dt>
                <dd className="font-medium">{formatTrackingTime(view.estimatedDelivery)}</dd>
              </div>
            )}
            {view.lastTrackingUpdate && (
              <div>
                <dt className="text-muted-foreground">Last carrier update</dt>
                <dd className="font-medium">{formatTrackingTime(view.lastTrackingUpdate)}</dd>
              </div>
            )}
          </dl>
          <ShipmentMap location={view.currentLocation} delivered={delivered} />
          {view.trackingUrl && (
            <a
              href={view.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-medium text-primary hover:underline"
            >
              Open on the {view.carrierName ?? 'carrier'} website →
            </a>
          )}
        </Card>
      )}

      <Card className="mt-6 p-6">
        <h2 className="mb-5 text-lg font-semibold">Order history</h2>
        <CustomerTimeline entries={view.timeline} />
      </Card>

      {smsAlertsEnabled() && !finished && (
        <Card className="mt-6 space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Get text alerts</h2>
            <p className="text-sm text-muted-foreground">
              We&apos;ll text you when this order ships, if it&apos;s delayed, and when it&apos;s
              delivered.
            </p>
          </div>
          <SmsAlertsForm
            orderNumber={view.orderNumber}
            token={token}
            alreadySubscribed={view.smsSubscribed}
          />
        </Card>
      )}

      <Card className="mt-6 p-6">
        <h2 className="mb-3 text-lg font-semibold">What&apos;s in this order</h2>
        <ul className="space-y-1 text-sm">
          {view.items.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              {item.quantity} × {item.name}
            </li>
          ))}
        </ul>
        {view.shipTo && <p className="mt-3 text-sm text-muted-foreground">Shipping to {view.shipTo}</p>}
      </Card>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Questions about your order?{' '}
        <Link href="/contact" className="text-primary hover:underline">
          Contact us
        </Link>
      </p>
    </main>
  )
}
