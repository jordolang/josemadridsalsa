import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createMetadata } from "@/lib/metadata";

export const dynamic = 'force-dynamic'


type PageProps = { params: Promise<{ trackingNumber: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { trackingNumber } = await params;
  const title = `Track Order ${trackingNumber} - Jose Madrid Salsa`;
  const description = `Track your Jose Madrid Salsa order with tracking number ${trackingNumber}.`;

  return createMetadata({
    title,
    description,
    pathname: `/track/${trackingNumber}`,
  });
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default async function TrackingPage({ params }: PageProps) {
  const { trackingNumber } = await params;

  // Find order by tracking number - check both Order.trackingNumber and ShippingLabel.trackingCode.
  // This page is public (only a tracking number is required), so select ONLY
  // non-sensitive tracking fields — never items, shipping address, or totals.
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { trackingNumber },
        { shippingLabels: { some: { trackingCode: trackingNumber } } }
      ]
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      carrierName: true,
      trackingNumber: true,
      trackingUrl: true,
      shippedAt: true,
      estimatedDelivery: true,
      deliveredAt: true,
      lastTrackingUpdate: true,
      trackingHistory: true,
      shippingLabels: {
        select: { trackingCode: true, carrierName: true, status: true },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const orderNum = order.orderNumber ?? order.id.slice(-6).toUpperCase();

  // An order can have multiple shipments; show the label matching the tracking
  // number from the URL, falling back to the first.
  const shippingLabel =
    order.shippingLabels?.find((l) => l.trackingCode === trackingNumber) ??
    order.shippingLabels?.[0];
  const carrier = order.carrierName ?? shippingLabel?.carrierName ?? "Carrier";
  const trackingUrl = order.trackingUrl ?? null;
  const trackingStatus = shippingLabel?.status ?? order.status;

  // Parse tracking history from JSON. The webhook stores EasyPost
  // tracking_details, so derive a flat `location` string from the nested
  // tracking_location object for display.
  const rawTrackingHistory = order.trackingHistory as Array<{
    status: string;
    message: string;
    datetime: string;
    tracking_location?: {
      city?: string;
      state?: string;
      country?: string;
      zip?: string;
    };
  }> | null;

  const trackingHistory = rawTrackingHistory?.map((event) => ({
    status: event.status,
    message: event.message,
    datetime: event.datetime,
    location:
      [event.tracking_location?.city, event.tracking_location?.state, event.tracking_location?.country]
        .filter(Boolean)
        .join(', ') || undefined,
  })) ?? null;

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Track Your Order</h1>
            <p className="text-muted-foreground mt-1">Order #{orderNum}</p>
          </div>
          <Badge>{order.status}</Badge>
        </div>

        <Card className="p-6">
          <h2 className="font-medium text-lg mb-4">Shipping Information</h2>
          <div className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tracking Number:</span>
                <p className="font-medium">{trackingNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Carrier:</span>
                <p className="font-medium">{carrier}</p>
              </div>
              {order.shippedAt && (
                <div>
                  <span className="text-muted-foreground">Shipped:</span>
                  <p className="font-medium">{formatDate(order.shippedAt)}</p>
                </div>
              )}
              {order.estimatedDelivery && (
                <div>
                  <span className="text-muted-foreground">Estimated Delivery:</span>
                  <p className="font-medium">{formatDate(order.estimatedDelivery)}</p>
                </div>
              )}
              {order.deliveredAt && (
                <div>
                  <span className="text-muted-foreground">Delivered:</span>
                  <p className="font-medium">{formatDate(order.deliveredAt)}</p>
                </div>
              )}
            </div>

            {trackingUrl && (
              <div className="pt-2">
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  Track on {carrier} website →
                </a>
              </div>
            )}
          </div>
        </Card>

        {trackingHistory && trackingHistory.length > 0 && (
          <Card className="p-6">
            <h2 className="font-medium text-lg mb-4">Tracking Timeline</h2>
            <div className="space-y-4">
              {trackingHistory.map((event, index) => (
                <div
                  key={index}
                  className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0"
                >
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                      <p className="font-medium text-sm">{event.message}</p>
                      <time className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(new Date(event.datetime))}
                      </time>
                    </div>
                    {event.location && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {event.location}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      Status: {event.status.replace(/_/g, ' ').toLowerCase()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!trackingHistory && order.lastTrackingUpdate && (
          <Card className="p-6">
            <h2 className="font-medium text-lg mb-4">Latest Update</h2>
            <div className="text-sm">
              <p className="text-muted-foreground">
                Last updated: {formatDate(order.lastTrackingUpdate)}
              </p>
              <p className="mt-2">Status: {trackingStatus}</p>
            </div>
          </Card>
        )}

        <div className="text-center text-sm text-muted-foreground">
          <p>Questions about your order?</p>
          <Link href="/contact" className="text-primary hover:underline">
            Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
