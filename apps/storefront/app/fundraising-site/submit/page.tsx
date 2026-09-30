import type { Metadata } from 'next'
import { FundraiserOrderForm } from '@/components/fundraising-site/fundraiser-order-form'
import { PageHero } from '../_components/page-hero'

export const metadata: Metadata = {
  title: 'Submit Your Fundraiser Order Form',
  description:
    'Submit your group’s Jose Madrid Salsa fundraiser order online: enter jars per flavor, see totals instantly, then sign and send.',
  alternates: { canonical: '/submit' },
}

/** fundraising.josemadridsalsa.com/submit — a group's signed bulk order, replacing the emailed spreadsheet. */
export default function SubmitOrderFormPage() {
  return (
    <>
      <PageHero eyebrow="Fundraiser order form" title="Submit your fundraiser order">
        <p>
          Tally your sellers&apos; sheets, enter the jars for each flavor and watch your totals add up. Then sign and submit
          — we&apos;ll email you a copy.
        </p>
      </PageHero>

      <section className="bg-muted/40 pb-28 pt-10 lg:pb-16">
        <div className="container mx-auto px-4">
          <FundraiserOrderForm />
        </div>
      </section>
    </>
  )
}
