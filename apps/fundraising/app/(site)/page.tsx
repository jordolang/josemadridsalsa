import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ClipboardList, HandCoins, Share2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeaturedFundraisingProducts } from '@/components/fundraising-site/featured-products'
import { FundraiserDownloads } from './_components/fundraiser-downloads'
import { YouTubeEmbed } from './_components/youtube-embed'

export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: 'Jose Madrid Salsa Fundraising: 50% Profit, $5 a Jar' },
  description:
    'Easy, fun, fast fundraising for schools, teams and clubs. Supporters buy $10 jars of Jose Madrid Salsa online and your group keeps $5 on every jar.',
  alternates: { canonical: '/' },
}

const STEPS = [
  {
    icon: ClipboardList,
    title: 'Sign up your group',
    text: 'Tell us about your fundraiser. We add your group to this site and email you ordering instructions.',
  },
  {
    icon: Share2,
    title: 'Share with supporters',
    text: 'Post it on social media and send it to family and friends. They order online, pick your group and add the seller’s name.',
  },
  {
    icon: HandCoins,
    title: 'Collect $5 a jar',
    text: 'We ship every order straight to your supporters’ homes, then send your group a check for $5 on every jar.',
  },
] as const

export default function FundraisingHomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-r from-verde-600 via-salsa-600 to-chile-600 text-white">
        <div className="absolute inset-0 bg-black/20" aria-hidden />
        <div className="container relative mx-auto grid items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-yellow-200">
              Fundraising with Jose Madrid Salsa
            </p>
            <h1 className="font-serif text-4xl font-bold leading-tight lg:text-6xl">
              Easy, fun, fast — and <span className="text-yellow-300">50% profit</span> for your group
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/90 lg:text-xl">
              We have helped groups across the Midwest raise money for more than 18 years. Now supporters anywhere
              in the U.S. can order online: every jar is $10, and <strong className="text-yellow-300">$5 of it goes to your group</strong>.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="bg-white text-salsa-700 hover:bg-yellow-50" asChild>
                <Link href="/start">
                  Start your fundraiser <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white bg-transparent text-white hover:bg-white/10" asChild>
                <Link href="/shop">Shop salsa</Link>
              </Button>
            </div>
          </div>
          <YouTubeEmbed videoId="XfZy3FzQj3g" title="Fundraising with Jose Madrid Salsa" />
        </div>
      </section>

      <section className="bg-card py-14">
        <div className="container mx-auto px-4">
          <h2 className="mb-10 text-center font-serif text-3xl font-bold text-foreground">How online fundraising works</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="card surface-shadow p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-salsa-500 to-chile-500 font-bold text-white">
                    {index + 1}
                  </span>
                  <step.icon className="h-6 w-6 text-salsa-600" aria-hidden />
                </div>
                <h3 className="mb-2 font-serif text-xl font-bold text-foreground">{step.title}</h3>
                <p className="text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Truck className="h-4 w-4 text-salsa-600" aria-hidden />
            Prefer a traditional order-form sale? <Link href="/start" className="font-semibold text-salsa-600 hover:underline">Community fundraising</Link> works too.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl font-bold text-foreground">Most popular flavors</h2>
              <p className="mt-2 text-muted-foreground">$10 a jar, mild to hot, and all gluten-free except Chipotle Con Queso.</p>
            </div>
            <Link href="/shop" className="inline-flex items-center gap-1 font-semibold text-salsa-600 hover:underline">
              Shop all flavors <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <FeaturedFundraisingProducts limit={8} />
        </div>
      </section>

      <section className="bg-muted py-14">
        <div className="container mx-auto grid items-center gap-6 px-4 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Supporting a group?</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Find the school, team or club you are buying for, then shop as usual. Your order ships to your door and
              $5 from every jar goes to them.
            </p>
          </div>
          <Button size="lg" variant="outline" className="border-salsa-500 text-salsa-600 hover:bg-salsa-50" asChild>
            <Link href="/groups">Find your group</Link>
          </Button>
        </div>
      </section>

      <FundraiserDownloads className="bg-card" />

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl bg-gradient-to-r from-salsa-600 to-chile-600 px-6 py-12 text-center text-white lg:py-16">
            <h2 className="font-serif text-3xl font-bold lg:text-4xl">Start your fundraiser today</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">
              No minimum sales, no tiers: your group keeps half of every sale. Sign up online in a couple of minutes.
            </p>
            <Button size="lg" className="mt-8 bg-white text-salsa-700 hover:bg-yellow-50" asChild>
              <Link href="/start">
                Get started <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
