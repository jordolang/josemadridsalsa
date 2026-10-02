import type { Metadata } from 'next'
import { Mail, Phone } from 'lucide-react'
import { FundraiserAccountForm } from '@/components/fundraising/fundraiser-account-form'
import { FundraiserSignupForm } from '@/components/fundraising/fundraiser-signup-form'
import { FUNDRAISING_CONTACT } from '@/components/fundraising-site/nav'
import { SITE_URL } from '@/lib/site-url'
import { PageHero } from '../_components/page-hero'

export const metadata: Metadata = {
  title: 'Fundraiser Sign-Up',
  description:
    'Sign your school, team or club up for a Jose Madrid Salsa fundraiser. We add your group to the site and email you ordering instructions to share.',
  alternates: { canonical: '/sign-up' },
}

const NEXT_STEPS = [
  'We add your group to this website so supporters can pick it at checkout.',
  'We email you ordering instructions to share with family, friends, co-workers and on social media.',
  'When your fundraiser ends, we send your group a check for $5 on every jar ordered.',
] as const

export default function FundraiserSignUpPage() {
  return (
    <>
      <PageHero eyebrow="Fundraiser sign-up" title="Start your fundraiser in two steps">
        <p>
          First create your organizer account, then tell us about your fundraiser — your group, the contact person and
          the dates. The second step is what puts your group on this website&apos;s checkout, so please do both.
        </p>
      </PageHero>

      <section className="py-14">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4">
          <h2 className="font-serif text-2xl font-bold text-foreground">Step 1 · Your organizer account</h2>
          <FundraiserAccountForm siteUrl={SITE_URL} />
        </div>
      </section>

      <section className="bg-card py-14">
        <div className="container mx-auto grid gap-10 px-4 lg:grid-cols-[1fr_2fr]">
          <aside>
            <h2 className="font-serif text-2xl font-bold text-foreground">Step 2 · Tell us about your fundraiser</h2>
            <p className="mt-3 text-muted-foreground">
              Fill in the form with your group and your fundraiser&apos;s dates. Here is what happens once it reaches us:
            </p>
            <ol className="mt-5 space-y-4" aria-label="What happens next">
              {NEXT_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-salsa-600 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 rounded-xl bg-muted p-5 text-sm">
              <p className="font-semibold text-foreground">Questions? We are always happy to help.</p>
              <a href={`mailto:${FUNDRAISING_CONTACT.email}`} className="mt-3 flex items-center gap-2 break-all text-salsa-600 hover:underline">
                <Mail className="h-4 w-4 shrink-0" aria-hidden /> {FUNDRAISING_CONTACT.email}
              </a>
              <a href={FUNDRAISING_CONTACT.phoneHref} className="mt-2 flex items-center gap-2 text-salsa-600 hover:underline">
                <Phone className="h-4 w-4 shrink-0" aria-hidden /> {FUNDRAISING_CONTACT.phone}
              </a>
            </div>
          </aside>
          <FundraiserSignupForm />
        </div>
      </section>
    </>
  )
}
