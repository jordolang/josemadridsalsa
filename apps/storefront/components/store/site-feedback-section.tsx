import Link from 'next/link'
import { MessageSquareHeart } from 'lucide-react'
import { SiteFeedbackForm } from '@/components/store/site-feedback-form'

interface SiteFeedbackSectionProps {
  heading?: string
  body?: string
}

/** Homepage block inviting visitors to rate the new site. The full page lives at /feedback. */
export function SiteFeedbackSection({
  heading = 'How Are We Doing?',
  body = 'Our new website is live. Tell us what works and what doesn’t by rating the parts you used from 1 to 10.',
}: SiteFeedbackSectionProps) {
  return (
    <section id="site-feedback" className="bg-muted/30 py-12 sm:py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <span className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-salsa-600">
            <MessageSquareHeart className="h-4 w-4" aria-hidden />
            Rate the New Site
          </span>
          <h2 className="mb-3 font-serif text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
            {heading}
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">{body}</p>
        </div>
        <div className="rounded-2xl border bg-background p-5 shadow-sm sm:p-8">
          <SiteFeedbackForm source="homepage" idPrefix="home-feedback" />
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Prefer a page of its own?{' '}
          <Link href="/feedback" className="font-medium text-salsa-600 underline-offset-4 hover:underline">
            Open the feedback page
          </Link>
        </p>
      </div>
    </section>
  )
}
