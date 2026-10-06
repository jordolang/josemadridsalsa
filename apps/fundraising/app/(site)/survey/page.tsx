import type { Metadata } from 'next'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHero } from '../_components/page-hero'

export const metadata: Metadata = {
  title: 'Fundraiser Customer Survey',
  description:
    'Completed a Jose Madrid Salsa fundraiser? Take our short survey and help us keep fundraising easy, inexpensive and high profit for groups nationwide.',
  alternates: { canonical: '/survey' },
}

const SURVEY_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfH2wlAqIuWDofVxNvSkqOuB-YDHQlFGBhrhNraVe10YY1hQQ/viewform'

export default function SurveyPage() {
  return (
    <>
      <PageHero eyebrow="Customer survey" title="Have you completed a fundraiser with us?" />
      <section className="py-14">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <p className="text-lg text-foreground/90">
            We would appreciate your feedback! We strive to offer an easy, inexpensive and high-profit fundraising
            opportunity to groups throughout the United States, and your comments help us improve.
          </p>
          <Button size="lg" className="mt-8 bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700" asChild>
            <a href={SURVEY_URL} target="_blank" rel="noopener noreferrer">
              Take the fundraising survey <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
            </a>
          </Button>
          <p className="mt-3 text-sm text-muted-foreground">Opens a Google Form in a new tab.</p>
          <p className="mt-8 text-muted-foreground">
            With your permission, we may publish some of your comments on our testimonials page.
          </p>
          <p className="mt-6 font-medium text-foreground">Thank you,<br />The Jose Madrid Salsa Team</p>
        </div>
      </section>
    </>
  )
}
