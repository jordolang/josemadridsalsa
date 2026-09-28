import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheck, Truck } from 'lucide-react'
import { PageHero } from '../_components/page-hero'

export const metadata: Metadata = {
  title: 'Shipping & Satisfaction',
  description:
    'Jose Madrid Salsa fundraising orders ship for a $10 flat rate, usually by USPS. Not satisfied, or arrived damaged? Contact us and we will make it right.',
  alternates: { canonical: '/shipping' },
}

export default function ShippingPage() {
  return (
    <>
      <PageHero eyebrow="Policies" title="Shipping & satisfaction" />
      <section className="py-14">
        <div className="container mx-auto max-w-3xl space-y-8 px-4">
          <div className="card surface-shadow p-8">
            <h2 className="flex items-center gap-3 font-serif text-2xl font-bold text-foreground">
              <Truck className="h-6 w-6 text-salsa-600" aria-hidden /> Shipping
            </h2>
            <p className="mt-4 text-foreground/90">
              Online orders ship for a <strong>flat rate of $10.00 per order</strong>. We choose the carrier — usually
              USPS, and UPS for larger orders.
            </p>
            <p className="mt-3 text-foreground/90">
              Community (order-form) fundraisers send us one bulk order, which ships to the group within about 10 days
              of payment. Bulk orders of 96 jars or more ship free.
            </p>
          </div>
          <div className="card surface-shadow p-8">
            <h2 className="flex items-center gap-3 font-serif text-2xl font-bold text-foreground">
              <ShieldCheck className="h-6 w-6 text-salsa-600" aria-hidden /> Satisfaction policy
            </h2>
            <p className="mt-4 text-foreground/90">
              If you are not satisfied with the quality of an item, or if our product was damaged in shipping, please{' '}
              <Link href="/contact" className="font-semibold text-salsa-600 hover:underline">
                contact us
              </Link>{' '}
              with your order number and the details. We will respond quickly to discuss possible remedies.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
