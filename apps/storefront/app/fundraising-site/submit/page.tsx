import type { Metadata } from 'next'
import { Mail, Phone } from 'lucide-react'
import { OrderSubmitForm } from '@/components/fundraising-site/order-submit-form'
import { FUNDRAISING_CONTACT } from '@/components/fundraising-site/nav'
import { DUE_PER_JAR } from '@/lib/fundraising-site/order-submission'
import { PageHero } from '../_components/page-hero'

export const metadata: Metadata = {
  title: 'Submit Your Final Order',
  description:
    'Community fundraisers: submit your group’s 100% final salsa order here. We fill your order from the information you enter.',
  alternates: { canonical: '/submit' },
}

const BEFORE_YOU_SUBMIT = [
  'Every seller has turned in their Tracking Sheet and money.',
  'Your Order Form (or Excel workbook) totals match the money collected.',
  'You have the shipping address where the salsa should go.',
] as const

export default function SubmitFinalOrderPage() {
  return (
    <>
      <PageHero eyebrow="Community fundraisers" title="Submit your final order">
        <p>When your order is 100% final, enter it here. Submitting tells us to fill your order with exactly what you enter.</p>
      </PageHero>

      <section className="py-14">
        <div className="container mx-auto grid gap-10 px-4 lg:grid-cols-[1fr_2fr]">
          <aside className="space-y-8">
            <div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Before you submit</h2>
              <ol className="mt-5 space-y-4">
                {BEFORE_YOU_SUBMIT.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-salsa-600 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Then pay ${DUE_PER_JAR} per jar</h2>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Check:</strong> payable to Jose Madrid Salsa, P.O. Box 1061, Zanesville, OH 43702-1061.</li>
                <li><strong className="text-foreground">Credit card:</strong> call {FUNDRAISING_CONTACT.phone}.</li>
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">Orders ship within 10 days of payment, usually within a week.</p>
            </div>
            <div className="rounded-xl bg-muted p-5 text-sm">
              <p className="font-semibold text-foreground">Need to change something after you submit?</p>
              <a href={`mailto:${FUNDRAISING_CONTACT.email}`} className="mt-3 flex items-center gap-2 break-all text-salsa-600 hover:underline">
                <Mail className="h-4 w-4 shrink-0" aria-hidden /> {FUNDRAISING_CONTACT.email}
              </a>
              <a href={FUNDRAISING_CONTACT.phoneHref} className="mt-2 flex items-center gap-2 text-salsa-600 hover:underline">
                <Phone className="h-4 w-4 shrink-0" aria-hidden /> {FUNDRAISING_CONTACT.phone}
              </a>
            </div>
          </aside>
          <OrderSubmitForm />
        </div>
      </section>
    </>
  )
}
