'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useCartStore } from '@/lib/store/cart'
import { formatPrice, getHeatLevelText } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

interface OrderItem {
  id: string
  productName: string
  productSku: string
  productImage: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  product: {
    id: string
    name: string
    slug: string
    featuredImage: string | null
    heatLevel: string
  } | null
}

interface Order {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  subtotal: number
  shippingCost: number
  tax: number
  discountAmount: number
  total: number
  shippingMethod: string
  trackingNumber: string | null
  customerNotes: string | null
  stripePaymentId: string | null
  createdAt: string
  updatedAt: string
  items: OrderItem[]
  user: {
    id: string
    email: string
    name: string | null
  }
}

export default function OrderConfirmationPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params?.orderId as string
  const clearCart = useCartStore((state) => state.clearCart)

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) {
        setError('Order ID is missing')
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/orders/${orderId}`)

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please log in to view your order')
          }
          if (response.status === 403) {
            throw new Error('You do not have permission to view this order')
          }
          if (response.status === 404) {
            throw new Error('Order not found')
          }
          throw new Error('Failed to load order')
        }

        const data = await response.json()
        setOrder(data)

        // Clear cart on successful order load
        clearCart()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order')
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId, clearCart])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your order...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <CardTitle>Order Not Found</CardTitle>
            </div>
            <CardDescription>{error || 'Unable to load order details'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              <Button asChild>
                <Link href="/products">Continue Shopping</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/account/orders">View My Orders</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Success Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
            <CardTitle className="text-3xl">Order Confirmed!</CardTitle>
            <CardDescription className="text-lg">
              Thank you for your order. We&apos;ll send you a confirmation email shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Order Number</p>
                <p className="text-lg font-semibold">{order.orderNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Order Date</p>
                <p className="text-lg font-semibold">{orderDate}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center space-x-4 pb-4 border-b last:border-0"
                >
                  <div className="relative h-16 w-16 flex-shrink-0">
                    {item.productImage ? (
                      <Image
                        src={item.productImage}
                        alt={item.productName}
                        fill
                        className="object-cover rounded-md"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted rounded-md flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">No image</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{item.productName}</h4>
                    {item.product && (
                      <p className="text-sm text-muted-foreground">
                        {getHeatLevelText(item.product.heatLevel)}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      SKU: {item.productSku}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(item.totalPrice)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping ({order.shippingMethod})</span>
                <span>{formatPrice(order.shippingCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatPrice(order.tax)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatPrice(order.discountAmount)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment & Status */}
        <Card>
          <CardHeader>
            <CardTitle>Payment & Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Payment Status</p>
                <p className="font-semibold capitalize">{order.paymentStatus.toLowerCase()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Order Status</p>
                <p className="font-semibold capitalize">{order.status.toLowerCase()}</p>
              </div>
              {order.trackingNumber && (
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Tracking Number</p>
                  <p className="font-semibold">{order.trackingNumber}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer Notes */}
        {order.customerNotes && (
          <Card>
            <CardHeader>
              <CardTitle>Order Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{order.customerNotes}</p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/products">Continue Shopping</Link>
          </Button>
          <Button variant="outline" asChild size="lg">
            <Link href="/account/orders">View All Orders</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
