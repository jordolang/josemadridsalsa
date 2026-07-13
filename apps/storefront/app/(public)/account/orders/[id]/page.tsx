import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createMetadata } from "@/lib/metadata";

export const dynamic = 'force-dynamic'


type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { orderNumber: true },
  });
  const num = order?.orderNumber ?? id.slice(-6).toUpperCase();
  const title = `Order #${num} - Jose Madrid Salsa`;
  const description = `Detailed summary for Jose Madrid Salsa order #${num}.`;

  return createMetadata({
    title,
    description,
    pathname: `/account/orders/${id}`,
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

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/account/orders/${id}`);
  }

  const order = await prisma.order.findFirst({
    where: { id, userId: (session.user as any).id },
    include: {
      items: { include: { product: true } },
      shippingAddress: true,
      billingAddress: true,
      shippingLabels: true,
    },
  });

  if (!order) {
    notFound();
  }

  const number = order.orderNumber ?? order.id.slice(-6).toUpperCase();
  const subtotal = Number(order.subtotal ?? 0);
  const shipping = Number(order.shippingCost ?? 0);
  const tax = Number(order.tax ?? 0);
  const total = Number(order.total);

  // Get tracking details from order or first shipping label
  const shippingLabel = order.shippingLabels?.[0];
  const trackingNumber = order.trackingNumber ?? shippingLabel?.trackingCode ?? null;
  const carrier = order.carrierName ?? shippingLabel?.carrierName ?? null;
  const trackingUrl = order.trackingUrl ?? null;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Order #{number}</h1>
        <Badge>{order.status}</Badge>
      </div>

      <Card className="p-4">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="font-medium mb-2">Order Info</h2>
            <div className="text-sm text-muted-foreground">
              <div>Placed: {order.createdAt.toLocaleString()}</div>
              {order.shippedAt ? <div>Shipped: {order.shippedAt.toLocaleString()}</div> : null}
              {order.deliveredAt ? <div>Delivered: {order.deliveredAt.toLocaleString()}</div> : null}
              {order.paymentMethod ? <div>Payment Method: {order.paymentMethod}</div> : null}
              {order.paymentStatus ? <div>Payment Status: {order.paymentStatus}</div> : null}
            </div>
          </div>
          <div>
            <h2 className="font-medium mb-2">Totals</h2>
            <div className="text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>{formatCurrency(shipping)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(tax)}</span></div>
              <Separator className="my-2" />
              <div className="flex justify-between font-medium"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>
          </div>
        </div>
      </Card>

      {trackingNumber && (
        <Card className="p-4">
          <h2 className="font-medium mb-2">Tracking Information</h2>
          <div className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tracking Number:</span>
                <p className="font-medium">{trackingNumber}</p>
              </div>
              {carrier && (
                <div>
                  <span className="text-muted-foreground">Carrier:</span>
                  <p className="font-medium">{carrier}</p>
                </div>
              )}
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

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href={`/track/${trackingNumber}`}
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                View detailed tracking →
              </Link>
              {trackingUrl && (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  Track on {carrier ?? 'carrier'} website →
                </a>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="font-medium mb-2">Items</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4">Qty</th>
                <th className="py-2 pr-4 text-right">Price</th>
                <th className="py-2 pr-0 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map(item => {
                const price = Number(item.unitPrice ?? 0);
                const lineTotal = Number(item.totalPrice ?? price * item.quantity);
                return (
                  <tr key={item.id} className="border-t">
                    <td className="py-2 pr-4">{item.product?.name ?? item.productName ?? "Item"}</td>
                    <td className="py-2 pr-4">{item.quantity}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(price)}</td>
                    <td className="py-2 pr-0 text-right">{formatCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-4">
          <h2 className="font-medium mb-2">Shipping Address</h2>
          {order.shippingAddress ? (
            <AddressBlock addr={order.shippingAddress} />
          ) : <div className="text-sm text-muted-foreground">No shipping address on file.</div>}
        </Card>
        <Card className="p-4">
          <h2 className="font-medium mb-2">Billing Address</h2>
          {order.billingAddress ? (
            <AddressBlock addr={order.billingAddress} />
          ) : <div className="text-sm text-muted-foreground">No billing address on file.</div>}
        </Card>
      </div>

      <div>
        <Link href="/account/orders" className="text-sm hover:underline">Back to orders</Link>
      </div>
    </div>
  );
}

function AddressBlock({ addr }: {
  addr: { 
    firstName: string; 
    lastName: string; 
    company?: string | null; 
    street: string; 
    city: string; 
    state: string; 
    zipCode: string;
    country: string;
    phone?: string | null;
  }
}) {
  return (
    <address className="not-italic text-sm text-muted-foreground">
      <div>{addr.firstName} {addr.lastName}</div>
      {addr.company && <div>{addr.company}</div>}
      <div>{addr.street}</div>
      <div>{addr.city}, {addr.state} {addr.zipCode}</div>
      <div>{addr.country}</div>
      {addr.phone && <div>Phone: {addr.phone}</div>}
    </address>
  );
}
