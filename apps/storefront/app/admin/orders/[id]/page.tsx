import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  CheckCircle,
  Package,
  Truck,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getOrderStatusVariant } from '@/lib/order-status'
import RefundDialog from '@/components/admin/RefundDialog'
import UpdateStatusDialog from '@/components/admin/UpdateStatusDialog'
import TrackingDialog from '@/components/admin/TrackingDialog'
import SendEmailDialog from '@/components/admin/SendEmailDialog'
import PrintInvoiceButton from '@/components/admin/PrintInvoiceButton'
import PackingSlipButton from '@/components/admin/PackingSlipButton'
import BuyShippingLabelDialog from '@/components/admin/BuyShippingLabelDialog'
import PirateShipDialog from '@/components/admin/PirateShipDialog'
import { MobileOrderDetail } from '@/components/admin/mobile/MobileOrderDetail'
import { getStripe } from '@/lib/stripe'
import { Decimal } from '@prisma/client/runtime/library'
import type { PaymentStatus } from '@prisma/client'
import { isPaid } from '@/lib/payments/status'
import { buildOrderTimeline } from '@/lib/orders/order-timeline'
import { OrderTimeline } from '@/components/admin/OrderTimeline'
import { FulfillItemsDialog } from '@/components/admin/FulfillItemsDialog'

async function getOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      items: {
        include: {
          product: true,
        },
      },
      shippingAddress: true,
      billingAddress: true,
      payments: {
        include: { refunds: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return order
}

/**
 * Build the order's activity history. Recorded domain events are merged with the timestamps
 * already stored on the order, so orders placed before the event log still show a history
 * rather than an empty card.
 */
async function getOrderTimeline(order: {
  id: string
  createdAt: Date
  shippedAt: Date | null
  deliveredAt: Date | null
  confirmationEmailSentAt: Date | null
  invoiceSentAt: Date | null
  printedInvoiceAt: Date | null
  printedPackingSlipAt: Date | null
  payments: { paidAt: Date | null; amount: number; provider: string | null; refunds: { processedAt: Date | null; createdAt: Date; amount: number; provider: string | null }[] }[]
}) {
  const events = await prisma.domainEvent.findMany({
    where: { entityType: 'order', entityId: order.id },
    orderBy: { createdAt: 'asc' },
  })

  return buildOrderTimeline({
    order,
    payments: order.payments,
    refunds: order.payments.flatMap((p) => p.refunds),
    events,
  })
}

async function getRefundableAmount(order: {
  stripePaymentId: string | null
  paymentStatus: PaymentStatus
  total: number | Decimal
}): Promise<number> {
  // If order can't be refunded, return 0
  if (!order.stripePaymentId) return 0
  if (!isPaid(order.paymentStatus) && order.paymentStatus !== 'PARTIALLY_REFUNDED') {
    return 0
  }

  try {
    const stripe = getStripe()
    // `charges` was removed from PaymentIntent in Stripe API 2022-11-15 (replaced by
    // `latest_charge`). Expanding it makes Stripe reject the call, which was caught below
    // and reported as $0 refundable on every order.
    const paymentIntent = await stripe.paymentIntents.retrieve(order.stripePaymentId)

    const chargeId = typeof paymentIntent.latest_charge === 'string'
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id
    if (!chargeId) return 0

    const charge = await stripe.charges.retrieve(chargeId)

    // Calculate refunded amount (Stripe stores in cents)
    const totalRefunded = (charge.amount_refunded || 0) / 100
    const totalPaid = Number(order.total)

    // Return remaining refundable amount
    return Math.max(0, totalPaid - totalRefunded)
  } catch (error) {
    console.error('Error fetching refundable amount:', error)
    return 0
  }
}

const STATUS_ICON: Record<string, LucideIcon> = {
  PENDING: Package,
  CONFIRMED: Package,
  PROCESSING: Package,
  SHIPPED: Truck,
  DELIVERED: CheckCircle,
  CANCELLED: XCircle,
  REFUNDED: Package,
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/admin/orders')
  }

  const order = await getOrder(id)

  if (!order) {
    notFound()
  }

  const canWrite = await hasPermission(user, 'orders:write')
  const timeline = await getOrderTimeline(order)

  // Calculate actual refundable amount
  const refundableAmount = await getRefundableAmount({
    stripePaymentId: order.stripePaymentId,
    paymentStatus: order.paymentStatus,
    total: order.total,
  })

  const StatusIcon = STATUS_ICON[order.status] ?? Package
  const statusLabel = STATUS_LABEL[order.status] ?? order.status
  const shopifyAdminBase =
    process.env.NEXT_PUBLIC_SHOPIFY_ADMIN_URL ??
    (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN
      ? `https://${(process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN || '')
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '')}/admin`
      : null)
  const normalizedShopifyAdminBase = shopifyAdminBase?.replace(/\/$/, '')
  const shopifyOrderUrl =
    normalizedShopifyAdminBase && order.shopifyOrderId
      ? `${normalizedShopifyAdminBase}/orders/${order.shopifyOrderId}`
      : null

  const actionContext = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    trackingNumber: order.trackingNumber,
    customerEmail: order.user?.email ?? order.guestEmail ?? '',
    total: Number(order.total),
    refundableAmount,
    hasShippingAddress: Boolean(order.shippingAddress),
  }

  const mobileOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt.toISOString(),
    total: Number(order.total),
    subtotal: Number(order.subtotal),
    tax: Number(order.tax),
    shippingCost: Number(order.shippingCost),
    discountAmount: Number(order.discountAmount),
    customerName: order.user?.name ?? order.guestEmail ?? 'Guest',
    customerEmail: order.user?.email ?? order.guestEmail ?? '',
    customerPhone: order.user?.phone ?? order.guestPhone ?? null,
    customerId: order.user?.id ?? null,
    trackingNumber: order.trackingNumber,
    shippingLabelUrl: order.shippingLabelUrl,
    shippingAddress: order.shippingAddress
      ? {
          firstName: order.shippingAddress.firstName,
          lastName: order.shippingAddress.lastName,
          street: order.shippingAddress.street,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          zipCode: order.shippingAddress.zipCode,
          country: order.shippingAddress.country,
          company: order.shippingAddress.company,
          phone: order.shippingAddress.phone,
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      productSku: item.productSku,
      productImage: item.productImage,
      quantity: item.quantity,
      quantityFulfilled: item.quantityFulfilled,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
    })),
    customerNotes: order.customerNotes,
  }

  return (
    <>
    <MobileOrderDetail
      className="md:hidden"
      order={mobileOrder}
      actionContext={actionContext}
      canWrite={canWrite}
      timeline={timeline}
    />
    <div className="hidden md:block space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/orders" aria-label="Back to orders">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Order {order.orderNumber}
            </h1>
            <p className="text-sm text-muted-foreground">
              Placed on {new Date(order.createdAt).toLocaleDateString()} at{' '}
              {new Date(order.createdAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={getOrderStatusVariant(order.status)} className="gap-1">
            <StatusIcon className="size-3" />
            {statusLabel}
          </Badge>
          {shopifyOrderUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={shopifyOrderUrl} target="_blank" rel="noreferrer">
                View in Shopify
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          <OrderTimeline entries={timeline} />

          {/* Order Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Order Items</CardTitle>
              {canWrite &&
                order.status !== 'CANCELLED' &&
                order.status !== 'REFUNDED' && (
                  <FulfillItemsDialog
                    orderId={order.id}
                    items={order.items.map((item) => ({
                      id: item.id,
                      productName: item.productName,
                      productSku: item.productSku,
                      quantity: item.quantity,
                      quantityFulfilled: item.quantityFulfilled,
                    }))}
                  />
                )}
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  {item.productImage && (
                    <div className="relative size-16 shrink-0">
                      <Image
                        src={item.productImage}
                        alt={item.productName}
                        fill
                        className="rounded object-cover"
                        sizes="64px"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      SKU: {item.productSku}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Quantity: {item.quantity} × $
                      {Number(item.unitPrice).toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantityFulfilled >= item.quantity
                        ? 'Fulfilled'
                        : `${item.quantityFulfilled} of ${item.quantity} fulfilled`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">
                      ${Number(item.totalPrice).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}

              {/* Order Summary */}
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">
                    ${Number(order.subtotal).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="tabular-nums">
                    ${Number(order.shippingCost).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">
                    ${Number(order.tax).toFixed(2)}
                  </span>
                </div>
                {Number(order.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="tabular-nums">
                      -${Number(order.discountAmount).toFixed(2)}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between pt-1 text-lg font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">
                    ${Number(order.total).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Information */}
          {order.shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle>Shipping Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    {order.shippingAddress.firstName}{' '}
                    {order.shippingAddress.lastName}
                  </p>
                  {order.shippingAddress.company && (
                    <p>{order.shippingAddress.company}</p>
                  )}
                  <p>{order.shippingAddress.street}</p>
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                    {order.shippingAddress.zipCode}
                  </p>
                  <p>{order.shippingAddress.country}</p>
                  {order.shippingAddress.phone && (
                    <p className="pt-2 text-muted-foreground">
                      Phone: {order.shippingAddress.phone}
                    </p>
                  )}
                </div>

                {order.trackingNumber && (
                  <div className="mt-4 rounded-lg bg-muted p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Tracking Number
                    </p>
                    <p className="mt-1 font-mono text-sm">
                      {order.trackingNumber}
                    </p>
                    {order.shippingLabelUrl && (
                      <a
                        href={order.shippingLabelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-primary hover:underline"
                      >
                        Track Package →
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Customer Notes */}
          {order.customerNotes && (
            <Card>
              <CardHeader>
                <CardTitle>Customer Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {order.customerNotes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {order.user ? (
                  <>
                    <div>
                      <p className="font-medium">{order.user.name || 'N/A'}</p>
                      <p className="text-muted-foreground">{order.user.email}</p>
                    </div>
                    {order.user.phone && (
                      <p className="text-muted-foreground">
                        Phone: {order.user.phone}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      asChild
                    >
                      <Link href={`/admin/users/${order.user.id}`}>
                        View Profile
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Guest Order</p>
                    <p className="text-muted-foreground">{order.guestEmail}</p>
                    {order.guestPhone && (
                      <p className="text-muted-foreground">
                        Phone: {order.guestPhone}
                      </p>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="capitalize">
                    {order.paymentMethod || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      isPaid(order.paymentStatus) ? 'default' : 'outline'
                    }
                  >
                    {order.paymentStatus}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          {canWrite && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <UpdateStatusDialog
                    orderId={order.id}
                    orderNumber={order.orderNumber}
                    currentStatus={order.status}
                  />
                  <TrackingDialog
                    orderId={order.id}
                    orderNumber={order.orderNumber}
                    currentTrackingNumber={order.trackingNumber}
                    currentStatus={order.status}
                  />
                  <PirateShipDialog
                    orderId={order.id}
                    orderNumber={order.orderNumber}
                    hasShippingAddress={!!order.shippingAddress}
                  />
                  <BuyShippingLabelDialog
                    orderId={order.id}
                    orderNumber={order.orderNumber}
                    hasShippingAddress={!!order.shippingAddress}
                  />
                  <RefundDialog
                    orderId={order.id}
                    orderNumber={order.orderNumber}
                    totalPaid={Number(order.total)}
                    refundableAmount={refundableAmount}
                    paymentStatus={order.paymentStatus}
                  />
                  <SendEmailDialog
                    orderId={order.id}
                    orderNumber={order.orderNumber}
                    customerEmail={order.user?.email ?? order.guestEmail ?? ''}
                    trackingNumber={order.trackingNumber}
                  />
                  <PrintInvoiceButton
                    order={{
                      id: order.id,
                      orderNumber: order.orderNumber,
                      createdAt: order.createdAt.toISOString(),
                      status: order.status,
                      paymentStatus: order.paymentStatus,
                      items: order.items.map((item) => ({
                        id: item.id,
                        productName: item.productName,
                        productSku: item.productSku,
                        quantity: item.quantity,
                        unitPrice: Number(item.unitPrice),
                        totalPrice: Number(item.totalPrice),
                      })),
                      subtotal: Number(order.subtotal),
                      shippingCost: Number(order.shippingCost),
                      tax: Number(order.tax),
                      discountAmount: Number(order.discountAmount),
                      total: Number(order.total),
                      shippingAddress: order.shippingAddress
                        ? {
                            firstName: order.shippingAddress.firstName,
                            lastName: order.shippingAddress.lastName,
                            street: order.shippingAddress.street,
                            city: order.shippingAddress.city,
                            state: order.shippingAddress.state,
                            zipCode: order.shippingAddress.zipCode,
                            country: order.shippingAddress.country,
                          }
                        : null,
                      billingAddress: order.billingAddress
                        ? {
                            firstName: order.billingAddress.firstName,
                            lastName: order.billingAddress.lastName,
                            street: order.billingAddress.street,
                            city: order.billingAddress.city,
                            state: order.billingAddress.state,
                            zipCode: order.billingAddress.zipCode,
                            country: order.billingAddress.country,
                          }
                        : null,
                      user: order.user
                        ? { name: order.user.name, email: order.user.email }
                        : null,
                    }}
                  />
                  <PackingSlipButton orderId={order.id} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
