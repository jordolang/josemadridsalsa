import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createMetadata } from "@/lib/metadata";
import { LeaveAReview } from "@/components/reviews/leave-a-review";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { orderNumber: true },
  });
  const num = order?.orderNumber ?? id.slice(-6).toUpperCase();
  const title = `Order Confirmation #${num} - Jose Madrid Salsa`;
  const description = `Thank you for your order! Your order #${num} has been confirmed.`;

  return createMetadata({
    title,
    description,
    pathname: `/order-confirmation/${id}`,
  });
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(v);
}

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      shippingAddress: true,
      billingAddress: true,
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

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-6">
        {/* Success Message */}
        <Card className="p-6 bg-green-50 border-green-200">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-green-900 mb-2">
                Thank you for your order!
              </h1>
              <p className="text-green-800">
                Your order has been successfully placed and is being processed.
                We&apos;ve sent a confirmation email to your inbox.
              </p>
            </div>
          </div>
        </Card>

        {/* Order Number and Status */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Order #{number}</h2>
          <Badge>{order.status}</Badge>
        </div>

        {/* Order Info and Totals */}
        <Card className="p-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2">Order Info</h3>
              <div className="text-sm text-muted-foreground">
                <div>Placed: {order.createdAt.toLocaleString()}</div>
                {order.paymentMethod ? <div>Payment Method: {order.paymentMethod}</div> : null}
                {order.paymentStatus ? <div>Payment Status: {order.paymentStatus}</div> : null}
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-2">Totals</h3>
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

        {/* Order Items */}
        <Card className="p-4">
          <h3 className="font-medium mb-2">Items</h3>
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

        {/* Shipping Address */}
        <Card className="p-4">
          <h3 className="font-medium mb-2">Shipping Address</h3>
          {order.shippingAddress ? (
            <AddressBlock addr={order.shippingAddress} />
          ) : <div className="text-sm text-muted-foreground">No shipping address on file.</div>}
        </Card>

        {/* Leave a Review */}
        <LeaveAReview
          source="order-confirmation"
          title="Mind sharing how it went?"
          description="A 15-second rating helps other shoppers find Jose Madrid Salsa. We'll save your review and open Google so you can post it there too."
          triggerLabel="Leave a Google review"
        />

        {/* Next Steps */}
        <Card className="p-4 bg-slate-50">
          <h3 className="font-medium mb-2">What&apos;s Next?</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>• You&apos;ll receive a shipping confirmation email with tracking information once your order ships.</p>
            <p>• Track your order status anytime by visiting your account.</p>
            <p>• If you have any questions, please contact our customer support.</p>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/">Continue Shopping</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/account/orders">View All Orders</Link>
          </Button>
        </div>
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
