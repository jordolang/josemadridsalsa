import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Truck, CheckCircle } from 'lucide-react'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
    },
  })

  return order
}

const statusInfo = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Package },
  CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', icon: Package },
  PROCESSING: { label: 'Processing', color: 'bg-purple-100 text-purple-800', icon: Package },
  SHIPPED: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: Package },
  REFUNDED: { label: 'Refunded', color: 'bg-gray-100 text-gray-800', icon: Package },
}

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:read'))) {
    redirect('/admin/orders')
  }

  const order = await getOrder(params.id)

  if (!order) {
    notFound()
  }

  const canWrite = await hasPermission(user, 'orders:write')
  const status = statusInfo[order.status as keyof typeof statusInfo]
  const StatusIcon = status.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/orders">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Order {order.orderNumber}</h1>
            <p className="text-slate-600">
              Placed on {new Date(order.createdAt).toLocaleDateString()} at{' '}
              {new Date(order.createdAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <Badge className={status.color}>
          <StatusIcon className="mr-1 h-3 w-3" />
          {status.label}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order Items */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Order Items</h2>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    {item.productImage && (
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="h-16 w-16 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-slate-600">SKU: {item.productSku}</p>
                      <p className="text-sm text-slate-600">
                        Quantity: {item.quantity} × ${Number(item.unitPrice).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        ${Number(item.totalPrice).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="mt-6 space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span>${Number(order.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Shipping</span>
                  <span>${Number(order.shippingCost).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Tax</span>
                  <span>${Number(order.tax).toFixed(2)}</span>
                </div>
                {Number(order.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-${Number(order.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 text-lg font-semibold">
                  <span>Total</span>
                  <span>${Number(order.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Shipping Information */}
          {order.shippingAddress && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Shipping Information</h2>
                <div className="space-y-2 text-sm">
                  <p className="font-medium">
                    {order.shippingAddress.firstName} {order.shippingAddress.lastName}
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
                    <p className="pt-2">Phone: {order.shippingAddress.phone}</p>
                  )}
                </div>

                {order.trackingNumber && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-600">Tracking Number</p>
                    <p className="font-mono text-sm">{order.trackingNumber}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Customer Notes */}
          {order.customerNotes && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-2">Customer Notes</h2>
                <p className="text-sm text-slate-600">{order.customerNotes}</p>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Customer</h2>
              <div className="space-y-3 text-sm">
                {order.user ? (
                  <>
                    <div>
                      <p className="font-medium">{order.user.name || 'N/A'}</p>
                      <p className="text-slate-600">{order.user.email}</p>
                    </div>
                    {order.user.phone && (
                      <p className="text-slate-600">Phone: {order.user.phone}</p>
                    )}
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href={`/admin/users/${order.user.id}`}>
                        View Profile
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Guest Order</p>
                    <p className="text-slate-600">{order.guestEmail}</p>
                    {order.guestPhone && (
                      <p className="text-slate-600">Phone: {order.guestPhone}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Payment Info */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Payment</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Method</span>
                  <span className="capitalize">{order.paymentMethod || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Status</span>
                  <Badge
                    className={
                      order.paymentStatus === 'PAID'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {order.paymentStatus}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Actions */}
          {canWrite && (
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Actions</h2>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full" disabled>
                    Update Status
                  </Button>
                  <Button variant="outline" className="w-full" disabled>
                    Add Tracking
                  </Button>
                  <Button variant="outline" className="w-full" disabled>
                    Send Email
                  </Button>
                  <Button variant="outline" className="w-full" disabled>
                    Print Invoice
                  </Button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Advanced actions coming soon
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
