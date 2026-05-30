import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import { ArrowUpRight } from 'lucide-react'

export const dynamic = 'force-dynamic'


type SuccessPageProps = {
  searchParams: Promise<{ order?: string }>
}

export default async function CheckoutSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const params = await searchParams
  const orderId = params?.order
  const googleReviewUrl =
    process.env.GOOGLE_REVIEW_URL ??
    process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ??
    'https://g.page/jose-madrid-salsa/review'

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

      <section className="rounded-2xl border border-emerald-100 bg-emerald-50 shadow-sm">
        <div className="px-6 py-6 space-y-4">
          <h2 className="text-lg font-semibold text-emerald-900">
            Share your experience
          </h2>
          <p className="text-sm text-emerald-800">
            Your feedback keeps our small business thriving. Tell others what you loved about your order and help fellow salsa fans discover Jose Madrid Salsa.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Link
              href={googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Leave a Google review
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
            <p className="text-xs text-emerald-700">
              It takes less than a minute and means the world to our team.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/salsas"
          className="inline-flex items-center justify-center rounded-md border border-salsa-500 px-5 py-2.5 text-sm font-semibold text-salsa-600 hover:bg-salsa-50 transition"
        >
          Continue shopping
        </Link>
        <p className="text-sm text-gray-500">
          Need help with your order? Email us at mike@josemadrid.net
        </p>
      </div>
    </div>
  )
}
