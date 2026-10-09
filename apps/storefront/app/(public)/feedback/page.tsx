import type { Metadata } from 'next'
import { SiteFeedbackForm } from '@/components/store/site-feedback-form'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Rate Our New Website - Jose Madrid Salsa',
  description:
    'Rate the new Jose Madrid Salsa website from 1 to 10 on layout, accessibility, ordering, the Battle Arena game and more, and tell us what to improve.',
  pathname: '/feedback',
})

export default function FeedbackPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative bg-gradient-to-r from-salsa-600 via-salsa-700 to-chile-600 text-white">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
          <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-chile-200">
            Site Feedback
          </span>
          <h1 className="mb-4 font-serif text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
            Rate Our New Website
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/90">
            We rebuilt josemadridsalsa.com and our fundraising site from the ground up. Pick the
            parts you used, score each from 1 to 10, and tell us what we should fix or add next.
          </p>
        </div>
      </section>
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border bg-background p-5 shadow-sm sm:p-8">
            <SiteFeedbackForm source="feedback-page" idPrefix="feedback-page" />
          </div>
        </div>
      </section>
    </div>
  )
}
