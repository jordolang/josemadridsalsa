import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

function formatCurrency(v: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(v);
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

  // Find order by tracking number - check both Order.trackingNumber and ShippingLabel.trackingCode
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { trackingNumber },
        { shippingLabels: { some: { trackingCode: trackingNumber } } }
      ]
    },
    include: {
      items: { include: { product: true } },
      shippingAddress: true,
      shippingLabels: true,
    },
  });

  if (!order) {
    notFound();
  }

  const orderNum = order.orderNumber ?? order.id.slice(-6).toUpperCase();
  const subtotal = Number(order.subtotal ?? 0);
  const shipping = Number(order.shippingCost ?? 0);
  const tax = Number(order.tax ?? 0);
  const total = Number(order.total);

  // Get tracking details from order or first shipping label
  const shippingLabel = order.shippingLabels?.[0];
  const carrier = order.carrierName ?? shippingLabel?.carrierName ?? "Carrier";
  const trackingUrl = order.trackingUrl ?? null;
  const trackingStatus = shippingLabel?.status ?? order.status;

  // Parse tracking history from JSON
  const trackingHistory = order.trackingHistory as Array<{
    status: string;
    message: string;
    datetime: string;
    location?: string;
  }> | null;

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

        <Card className="p-6">
          <h2 className="font-medium text-lg mb-4">Order Summary</h2>
          <div className="space-y-4">
            <div className="text-sm">
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Order placed:</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              {order.shippingAddress && (
                <div className="py-2">
                  <p className="text-muted-foreground mb-1">Shipping to:</p>
                  <address className="not-italic text-sm">
                    <div>{order.shippingAddress.firstName} {order.shippingAddress.lastName}</div>
                    <div>{order.shippingAddress.street}</div>
                    <div>
                      {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                    </div>
                  </address>
                </div>
              )}
            </div>

            <Separator />

            <div className="text-sm">
              <div className="flex justify-between py-1">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Shipping</span>
                <span>{formatCurrency(shipping)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Tax</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between py-1 font-medium">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-2">Items ({order.items.length})</h3>
              <div className="space-y-2">
                {order.items.map(item => {
                  const price = Number(item.unitPrice ?? 0);
                  const lineTotal = Number(item.totalPrice ?? price * item.quantity);
                  return (
                    <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b last:border-b-0">
                      <div className="flex items-center gap-3 flex-1">
                        {item.productImage && (
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="font-medium">{formatCurrency(lineTotal)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

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
