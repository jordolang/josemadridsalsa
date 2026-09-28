import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Download, FileArchive, FileText, Globe, Mail, Phone, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FUNDRAISING_CONTACT } from '@/components/fundraising-site/nav'
import { PageHero } from '../_components/page-hero'

export const metadata: Metadata = {
  title: 'Start Your Fundraiser',
  description:
    'Start a Jose Madrid Salsa fundraiser: sign up for online sales or download 25, 16 or 9 flavor order forms for a community sale. 50% profit on every jar.',
  alternates: { canonical: '/start' },
}

const DOWNLOAD_DIR = '/fundraising/downloads'

const ORDER_FORMS = [
  { href: `${DOWNLOAD_DIR}/25-flavor-fundraiser-forms.zip`, label: '25 flavor fundraiser forms', meta: 'ZIP, 2.3 MB' },
  { href: `${DOWNLOAD_DIR}/16-flavor-fundraiser-forms.zip`, label: '16 flavor fundraiser forms', meta: 'ZIP, 2.1 MB' },
  { href: `${DOWNLOAD_DIR}/9-flavor-fundraiser-forms.zip`, label: '9 flavor fundraiser forms', meta: 'ZIP, 2.3 MB' },
] as const

const FLIERS = [
  { href: `${DOWNLOAD_DIR}/sample-flier-2023.pdf`, label: 'Sample flier', meta: 'PDF, 766 KB' },
  { href: `${DOWNLOAD_DIR}/flyer-template.pdf`, label: 'Flier template', meta: 'PDF, 582 KB' },
] as const

function DownloadLink({ href, label, meta, zip }: { href: string; label: string; meta: string; zip?: boolean }) {
  const Icon = zip ? FileArchive : FileText
  return (
    <a
      href={href}
      download
      className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-salsa-400 hover:bg-salsa-50"
    >
      <Icon className="h-5 w-5 shrink-0 text-salsa-600" aria-hidden />
      <span className="flex-1 font-medium text-foreground">
        {label} <span className="text-sm font-normal text-muted-foreground">({meta})</span>
      </span>
      <Download className="h-4 w-4 text-muted-foreground" aria-hidden />
    </a>
  )
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
              <li>• Tally the totals for each flavor and send us one bulk order.</li>
              <li>• We ship it to your group within 10 days of receiving payment.</li>
              <li>• Free shipping on orders of 96 jars or more.</li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Each pack includes a tracking sheet, a spreadsheet order form, a flavor handout, a how-to-launch guide and
              salsa facts with fundraising safety tips.
            </p>
          </article>
        </div>
      </section>

      <section className="bg-card py-14">
        <div className="container mx-auto grid gap-10 px-4 lg:grid-cols-2">
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Order form packs</h2>
            <p className="mt-2 text-muted-foreground">Each button downloads a zip file with the forms for that sale.</p>
            <div className="mt-5 space-y-3">
              {ORDER_FORMS.map((file) => (
                <DownloadLink key={file.href} {...file} zip />
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Fliers</h2>
            <p className="mt-2 text-muted-foreground">Print them, post them, or share them with your supporters.</p>
            <div className="mt-5 space-y-3">
              {FLIERS.map((file) => (
                <DownloadLink key={file.href} {...file} />
              ))}
            </div>
          </div>
        </div>
      </section>

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
