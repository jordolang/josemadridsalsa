import Link from 'next/link'
import { XCircle } from 'lucide-react'

export default function CheckoutCancelPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <XCircle className="h-16 w-16 text-red-500" />
        </div>
        <p className="text-sm uppercase tracking-widest text-red-500">
          Payment cancelled
        </p>
        <h1 className="text-3xl lg:text-4xl font-serif font-bold text-gray-900">
          Your payment was not completed
        </h1>
        <p className="text-gray-600">
          Don&apos;t worry - no charges were made to your account. Your cart items are still saved and ready when you are.
        </p>
      </div>

      <section className="rounded-2xl border border-amber-100 bg-amber-50 shadow-sm">
        <div className="px-6 py-6 space-y-4">
          <h2 className="text-lg font-semibold text-amber-900">
            What happened?
          </h2>
          <p className="text-sm text-amber-800">
            Your payment was cancelled before completion. This could be because you clicked the back button, closed the payment window, or chose to cancel the transaction.
          </p>
          <p className="text-sm text-amber-800">
            No charges were made, and your cart is still waiting for you.
          </p>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4">
        <Link
          href="/checkout"
          className="inline-flex items-center justify-center rounded-md bg-salsa-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-salsa-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-salsa-600"
        >
          Try again
        </Link>
        <Link
          href="/salsas"
          className="inline-flex items-center justify-center rounded-md border border-salsa-500 px-6 py-3 text-sm font-semibold text-salsa-600 hover:bg-salsa-50 transition"
        >
          Continue shopping
        </Link>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-500">
          Need help completing your order? Email us at{' '}
          <a href="mailto:mike@josemadrid.net" className="underline hover:text-gray-700">
            mike@josemadrid.net
          </a>
        </p>
      </div>
    </div>
  )
}
