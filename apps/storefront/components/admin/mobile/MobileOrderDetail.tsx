import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  formatOrderStatus,
  getOrderStatusVariant,
} from '@/lib/order-status'
import type { OrderStatus } from '@/lib/admin/order-primary-cta'
import { OrderActionBar } from './OrderActionBar'
import type { OrderActionContext } from './OrderActionsDrawer'
import { cn } from '@/lib/utils'

interface MobileOrderDetailOrder {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: string
  createdAt: string
  total: number
  subtotal: number
  tax: number
  shippingCost: number
  discountAmount: number
  customerName: string
  customerEmail: string
  customerPhone: string | null
  customerId: string | null
  trackingNumber: string | null
  shippingLabelUrl: string | null
  shippingAddress: {
    firstName: string
    lastName: string
    street: string
    city: string
    state: string
    zipCode: string
    country: string
    company: string | null
    phone: string | null
  } | null
  items: {
    id: string
    productName: string
    productSku: string
    productImage: string | null
    quantity: number
    unitPrice: number
    totalPrice: number
  }[]
  customerNotes: string | null
}

interface MobileOrderDetailProps {
  order: MobileOrderDetailOrder
  actionContext: OrderActionContext
  canWrite: boolean
  className?: string
}

export function MobileOrderDetail({
  order,
  actionContext,
  canWrite,
  className,
}: MobileOrderDetailProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/orders"
              className="-ml-1 flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50"
              aria-label="Back to orders"
            >
              <span aria-hidden>←</span>
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                Order
              </p>
              <p className="truncate text-lg font-semibold">
                {order.orderNumber}
              </p>
            </div>
            <Badge
              variant={getOrderStatusVariant(order.status)}
              aria-label={`Order status: ${formatOrderStatus(order.status)}`}
            >
              {formatOrderStatus(order.status)}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Placed {new Date(order.createdAt).toLocaleString()}
          </p>
        </section>

        <section className="rounded-lg border bg-card">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">Items</h2>
          <ul className="divide-y">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-3 p-3">
                {item.productImage && (
                  <div className="relative size-14 shrink-0">
                    <Image
                      src={item.productImage}
                      alt={item.productName}
                      fill
                      className="rounded object-cover"
                      sizes="56px"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.productName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    SKU {item.productSku}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × ${item.unitPrice.toFixed(2)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium tabular-nums">
                  ${item.totalPrice.toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t p-4 text-sm">
            <SummaryRow label="Subtotal" value={order.subtotal} />
            <SummaryRow label="Shipping" value={order.shippingCost} />
            <SummaryRow label="Tax" value={order.tax} />
            {order.discountAmount > 0 && (
              <SummaryRow label="Discount" value={-order.discountAmount} />
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">${order.total.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {order.shippingAddress && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Shipping</h2>
            <p className="text-sm">
              {order.shippingAddress.firstName}{' '}
              {order.shippingAddress.lastName}
              <br />
              {order.shippingAddress.street}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.zipCode}
              <br />
              {order.shippingAddress.country}
            </p>
            {order.trackingNumber && (
              <div className="mt-3 rounded bg-muted p-3 text-xs">
                <p className="uppercase tracking-wide text-muted-foreground">
                  Tracking
                </p>
                <p className="mt-0.5 font-mono break-all">
                  {order.trackingNumber}
                </p>
                {order.shippingLabelUrl && (
                  <a
                    href={order.shippingLabelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-primary hover:underline"
                  >
                    Track package →
                  </a>
                )}
              </div>
            )}
          </section>
        )}

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Customer</h2>
          <p className="text-sm font-medium">{order.customerName}</p>
          <p className="break-all text-sm text-muted-foreground">
            {order.customerEmail}
          </p>
          {order.customerPhone && (
            <p className="text-sm text-muted-foreground">
              {order.customerPhone}
            </p>
          )}
          {order.customerId && (
            <Link
              href={`/admin/users/${order.customerId}`}
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              View profile →
            </Link>
          )}
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Payment</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant={order.paymentStatus === 'PAID' ? 'default' : 'outline'}
            >
              {order.paymentStatus}
            </Badge>
          </div>
        </section>

        {order.customerNotes && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Customer notes</h2>
            <p className="text-sm text-muted-foreground">
              {order.customerNotes}
            </p>
          </section>
        )}
      </div>
      {canWrite && <OrderActionBar order={actionContext} />}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">${value.toFixed(2)}</span>
    </div>
  )
}
