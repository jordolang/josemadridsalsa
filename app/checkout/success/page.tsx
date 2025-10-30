import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'

type SuccessPageProps = {
  searchParams: Promise<{ order?: string }>
}

export default async function CheckoutSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const params = await searchParams
  const orderId = params?.order

  if (!orderId) {
    notFound()
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })

  if (!order) {
    notFound()
  }

  const subtotal = Number(order.subtotal ?? 0)
  const shipping = Number(order.shippingCost ?? 0)
  const tax = Number(order.tax ?? 0)
  const total = Number(order.total ?? 0)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
      <div className="text-center space-y-4">
        <p className="text-sm uppercase tracking-widest text-salsa-500">
          Order confirmed
        </p>
        <h1 className="text-3xl lg:text-4xl font-serif font-bold text-gray-900">
          Thank you for your purchase!
        </h1>
        <p className="text-gray-600">
          We&apos;ve emailed a receipt to {order.guestEmail ?? 'your inbox'}.
          Your order number is{' '}
          <span className="font-semibold text-gray-900">
            {order.orderNumber}
          </span>
          .
        </p>
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <header className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Order summary
            </h2>
          </header>
          <div className="divide-y divide-gray-100">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-6 py-4 text-sm text-gray-700"
              >
                <div>
                  <p className="font-medium text-gray-900">{item.productName}</p>
                  <p className="text-xs text-gray-500">
                    Qty {item.quantity} • SKU {item.productSku}
                  </p>
                </div>
                <p className="font-medium text-gray-900">
                  {formatPrice(Number(item.totalPrice ?? 0))}
                </p>
              </div>
            ))}
          </div>
          <footer className="border-t border-gray-100 px-6 py-4 space-y-2 text-sm">
            <div className="flex items-center justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>Shipping</span>
              <span>{formatPrice(shipping)}</span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>Tax</span>
              <span>{formatPrice(tax)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total paid</span>
              <span>{formatPrice(total)}</span>
            </div>
          </footer>
        </section>

        {order.shippingMethod && (
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <header className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Shipping details
              </h2>
            </header>
            <div className="px-6 py-4 text-sm text-gray-700 whitespace-pre-line">
              {order.shippingMethod}
            </div>
          </section>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/salsas"
          className="inline-flex items-center justify-center rounded-md border border-salsa-500 px-5 py-2.5 text-sm font-semibold text-salsa-600 hover:bg-salsa-50 transition"
        >
          Continue shopping
        </Link>
        <p className="text-sm text-gray-500">
          Need help with your order? Email us at support@josemadridsalsa.com
        </p>
      </div>
    </div>
  )
}
