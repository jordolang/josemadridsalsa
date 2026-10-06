import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, DollarSign, Heart, Layers, Leaf, Store, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHero } from '../_components/page-hero'

export const metadata: Metadata = {
  title: 'Why Jose Madrid Fundraising',
  description:
    'Why groups choose Jose Madrid Salsa: 50% profit, online and order-form options, a $10 gluten-free product people want, and a small team that loves helping.',
  alternates: { canonical: '/why-jose-madrid' },
}

const REASONS = [
  {
    icon: DollarSign,
    title: '50% profit',
    text: 'Every jar sells for $10 and $5 of it goes to your group. No tiers to climb and no sales minimums to hit.',
  },
  {
    icon: Layers,
    title: 'Two ways to fundraise',
    text: 'Run a traditional order-form sale, our online fundraiser, or both at once — many of our groups do.',
  },
  {
    icon: Leaf,
    title: 'A product people actually want',
    text: 'Food sells, and ours is a healthy, affordable choice at $10 a jar. Every flavor is gluten-free except Chipotle Con Queso.',
  },
  {
    icon: Users,
    title: 'Something for everyone',
    text: 'Dozens of flavors from mild to hot, including fruit salsas, reach a wide audience of supporters.',
  },
  {
    icon: BookOpen,
    title: 'Help getting started',
    text: 'Order forms, flavor handouts, fliers and a how-to guide for launching your fundraiser are free to download.',
  },
  {
    icon: Store,
    title: 'A small business',
    text: 'We are a family salsa company from Zanesville, Ohio, with a huge passion for fundraising.',
  },
  {
    icon: Heart,
    title: 'We love helping others',
    text: 'You will work with real people who answer the phone and want your fundraiser to succeed.',
  },
] as const

export default function WhyJoseMadridPage() {
  return (
    <>
      <PageHero eyebrow="Why Jose Madrid?" title="A win-win fundraiser with a unique flair">
        <p>
          Fundraising options are a dime a dozen, and we know it. Here is why we are confident your group will succeed
          with ours.
        </p>
      </PageHero>

      <section className="py-14">
        <div className="container mx-auto grid gap-6 px-4 sm:grid-cols-2 lg:grid-cols-3">
          {REASONS.map((reason) => (
            <div key={reason.title} className="card surface-shadow p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-salsa-500 to-chile-500">
                <reason.icon className="h-6 w-6 text-white" aria-hidden />
              </div>
              <h2 className="mb-2 font-serif text-xl font-bold text-foreground">{reason.title}</h2>
              <p className="text-muted-foreground">{reason.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card py-14">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-serif text-3xl font-bold text-foreground">Give us a try — you won&apos;t be disappointed</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button size="lg" className="bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700" asChild>
              <Link href="/start">Start your fundraiser</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-salsa-500 text-salsa-600 hover:bg-salsa-50" asChild>
              <Link href="/testimonials">Read testimonials</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
