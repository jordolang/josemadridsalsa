import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Globe, Mail, Phone, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FUNDRAISING_CONTACT } from '@/components/fundraising-site/nav'
import { FundraiserDownloads } from '../_components/fundraiser-downloads'
import { PageHero } from '../_components/page-hero'

export const metadata: Metadata = {
  title: 'Start Your Fundraiser',
  description:
    'Start a Jose Madrid Salsa fundraiser: sign up for online sales or download 25, 16 or 9 flavor order forms for a community sale. 50% profit on every jar.',
  alternates: { canonical: '/start' },
}

export default function StartFundraiserPage() {
  return (
    <>
      <PageHero eyebrow="Start your fundraiser" title="Our goal is to make your fundraiser easy and profitable">
        <p>Two ways to raise money — $5 back to your group on every $10 jar either way. We encourage you to use both!</p>
      </PageHero>

      <section className="py-14">
        <div className="container mx-auto grid gap-8 px-4 lg:grid-cols-2">
          <article className="card surface-shadow flex flex-col p-8">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-salsa-500 to-chile-500">
              <Globe className="h-7 w-7 text-white" aria-hidden />
            </div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Online fundraising</h2>
            <p className="mt-3 text-muted-foreground">
              Fill out the sign-up form and we will add your group to this website, then send you ordering
              instructions to share with friends, family and co-workers and post on social media.
            </p>
            <ul className="mt-4 space-y-2 text-foreground/90">
              <li>• Supporters choose from every flavor we make, as many jars as they like.</li>
              <li>• At checkout they pick your group and type the seller&apos;s name.</li>
              <li>• We ship straight to their home or office ($10 flat rate per order).</li>
              <li>• When the fundraiser ends, we mail your group a check for $5 per jar.</li>
            </ul>
            <Button size="lg" className="mt-8 h-auto self-start whitespace-normal py-3 bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700" asChild>
              <Link href="/sign-up">
                Sign up for online fundraising <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </article>

          <article className="card surface-shadow flex flex-col p-8">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-verde-500 to-salsa-500">
              <Users className="h-7 w-7 text-white" aria-hidden />
            </div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Community fundraising</h2>
            <p className="mt-3 text-muted-foreground">
              Sell in person with our order forms. Download a pack, hand out copies to your group and get selling.
            </p>
            <ul className="mt-4 space-y-2 text-foreground/90">
              <li>• Pre-set forms for 25, 16 or just 9 flavors.</li>
              <li>• We recommend running the sale for 2 to 3 weeks.</li>
              <li>• Tally the totals for each flavor on one order form.</li>
              <li>• When it is 100% final, submit it online and we fill it from what you enter.</li>
              <li>• We ship it to your group within 10 days of receiving payment.</li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Each pack includes a tracking sheet, a spreadsheet order form, a flavor handout, a how-to-launch guide and
              salsa facts with fundraising safety tips.
            </p>
            <Button size="lg" variant="outline" className="mt-6 h-auto self-start whitespace-normal py-3" asChild>
              <Link href="/submit">
                Submit your final order <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </article>
        </div>
      </section>

      <FundraiserDownloads className="bg-card" />

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl bg-gradient-to-r from-salsa-600 to-chile-600 px-6 py-12 text-center text-white">
            <h2 className="font-serif text-3xl font-bold">Ready to go?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-white/90">
              Sign up and we will set up your group. Questions or problems with the forms? We are always happy to hear from you.
            </p>
            <Button size="lg" className="mt-8 bg-white text-salsa-700 hover:bg-yellow-50" asChild>
              <Link href="/sign-up">
                Sign up your group <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm text-white/90">
              <a href={`mailto:${FUNDRAISING_CONTACT.email}`} className="inline-flex items-center gap-2 hover:text-white">
                <Mail className="h-4 w-4" aria-hidden /> {FUNDRAISING_CONTACT.email}
              </a>
              <a href={FUNDRAISING_CONTACT.phoneHref} className="inline-flex items-center gap-2 hover:text-white">
                <Phone className="h-4 w-4" aria-hidden /> {FUNDRAISING_CONTACT.phone}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
