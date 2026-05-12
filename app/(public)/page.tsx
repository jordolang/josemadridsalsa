import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { Metadata } from 'next'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { createMetadata } from '@/lib/metadata'
import { LocationMapClient } from '@/components/store/location-map-client'
import { getReviewsData, getCalendarEvents } from '@/lib/server/google-data'
import { ActiveCampaignsGrid } from '@/components/fundraiser/active-campaigns-grid'

// Lazy load heavy below-the-fold components
const AnimatedTestimonials = dynamic(
  () => import('@/components/store/animated-testimonials').then(mod => ({ default: mod.AnimatedTestimonials })),
  { loading: () => <div className="h-96 animate-pulse bg-muted rounded-lg" /> }
)

const GiftBoxSelector = dynamic(
  () => import('@/components/store/gift-box-selector').then(mod => ({ default: mod.GiftBoxSelector })),
  { loading: () => <div className="h-96 animate-pulse bg-muted rounded-lg" /> }
)

const ScheduleMapWrapper = dynamic(
  () => import('@/components/store/schedule-map-wrapper').then(mod => ({ default: mod.ScheduleMapWrapper })),
  { loading: () => <div className="h-[520px] animate-pulse bg-muted rounded-3xl" /> }
)

export const metadata: Metadata = createMetadata({
  title: 'Jose Madrid Salsa - Premium Gourmet Salsa',
  description:
    'Discover artisan small-batch salsas crafted in Ohio. Shop mild to extra hot varieties, find fundraising programs, or explore wholesale partnerships.',
  pathname: '/',
})

// This is an async server component — it fetches ONCE on the server at render time.
// Next.js ISR caches the result (reviews: 2h, calendar: 5min).
// Zero Google API calls happen in the browser on load. The Refresh button
// on the schedule map is the only path that ever triggers a client fetch.
export default async function Home() {
  // Both fetches run in parallel — total overhead is max(t_reviews, t_calendar)
  const [reviewsData, calendarEvents] = await Promise.all([
    getReviewsData(),
    getCalendarEvents(),
  ])

  return (
    <ErrorBoundary>
      <main className="min-h-screen">
      {/* Hero Section */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-white animate-slide-up">
              <h1 className="text-5xl lg:text-6xl font-bold font-serif mb-6">
                Premium Gourmet 
                <span className="block text-chile-200">Salsa</span>
              </h1>
              <p className="text-xl lg:text-2xl mb-8 text-gray-100 leading-relaxed">
                Made with the finest ingredients in Ohio. From mild to fiery hot, 
                discover the perfect salsa for every taste.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/salsas" className="btn-primary text-lg px-8 py-4">
                  Shop Now
                </Link>
                <Link href="/about" className="btn-secondary text-lg px-8 py-4 bg-white/10 border-white/20 text-white hover:bg-white/20">
                  Our Story
                </Link>
              </div>
            </div>
            <div className="relative animate-slide-up animation-delay-200">
              <div className="relative w-full h-96 lg:h-[500px]">
                <Image
                  src="/images/shared/Hero-Image-Mike.png"
                  alt="Fresh salsa with chips"
                  fill
                  className="object-cover object-center rounded-2xl shadow-2xl"
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 45vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Categories */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold font-serif text-foreground mb-4">
                Find Your Perfect <span className="text-gradient">Heat Level</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                From those who like it mild to the heat seekers, we have the perfect salsa for everyone.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Mild Salsa */}
            <ScrollReveal delay={100}>
              <div className="card p-8 text-center group hover:scale-105 transition-transform duration-300">
                <div className="w-20 h-20 bg-verde-100 dark:bg-verde-900/40 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <span className="text-3xl">🌿</span>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">Mild</h3>
                <p className="text-muted-foreground mb-6">
                  Perfect for those who enjoy flavor without the heat. Great for kids and mild palates.
                </p>
                <Link href="/salsas?heat=mild" className="btn-secondary w-full">
                  Shop Mild
                </Link>
              </div>
            </ScrollReveal>

            {/* Medium Salsa */}
            <ScrollReveal delay={200}>
              <div className="card p-8 text-center group hover:scale-105 transition-transform duration-300">
                <div className="w-20 h-20 bg-chile-100 dark:bg-chile-900/40 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <span className="text-3xl">🌶️</span>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">Medium</h3>
                <p className="text-muted-foreground mb-6">
                  The perfect balance of flavor and heat. Our most popular choice for everyday enjoyment.
                </p>
                <Link href="/salsas?heat=medium" className="btn-secondary w-full">
                  Shop Medium
                </Link>
              </div>
            </ScrollReveal>

            {/* Hot Salsa */}
            <ScrollReveal delay={300}>
              <div className="card p-8 text-center group hover:scale-105 transition-transform duration-300">
                <div className="w-20 h-20 bg-salsa-100 dark:bg-salsa-900/30 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <span className="text-3xl">🔥</span>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">Hot</h3>
                <p className="text-muted-foreground mb-6">
                  For those who love the heat! Bold flavors with a serious kick that builds with each bite.
                </p>
                <Link href="/salsas?heat=hot" className="btn-secondary w-full">
                  Shop Hot
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal className="scroll-reveal-left">
              <div>
                <h2 className="text-4xl font-bold font-serif text-foreground mb-6">
                  More Than Just Great Taste
                </h2>
                <div className="space-y-8">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-salsa-100 dark:bg-salsa-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-salsa-600 text-xl">🏪</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">Fundraising Made Easy</h3>
                      <p className="text-muted-foreground">
                        Perfect for schools, churches, and organizations. High-profit margins and products people actually want.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-verde-100 dark:bg-verde-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-verde-600 text-xl">🏭</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">Wholesale Options</h3>
                      <p className="text-muted-foreground">
                        Stock our premium salsas in your store. Competitive pricing with excellent support.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-chile-100 dark:bg-chile-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-chile-600 text-xl">📍</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">Local Presence</h3>
                      <p className="text-muted-foreground">
                        Find us at local stores throughout Ohio, or order online for delivery anywhere.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal className="scroll-reveal-right">
              <div className="relative">
                <div className="relative w-full h-96 lg:h-[500px]">
                  <Image
                    src="/images/shared/salsa-bowl.png"
                    alt="Fresh ingredients for salsa"
                    fill
                    className="object-contain rounded-2xl"
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 45vw, 40vw"
                  />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Where Is Jose — Live Schedule Map */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="mx-auto max-w-3xl text-center mb-10">
              <span className="inline-block text-sm font-semibold uppercase tracking-widest text-salsa-600 mb-3">
                On the Move
              </span>
              <h2 className="text-4xl font-bold font-serif text-foreground mb-4">
                Where Is <span className="text-gradient">Jose?</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Follow Jose Madrid Salsa to farmers markets, retail demos, and special events — updated live from our calendar.
              </p>
            </div>
            <ScheduleMapWrapper initialEvents={calendarEvents} />
            <div className="mt-6 text-center">
              <Link href="/where-is-jose" className="btn-secondary text-sm px-6 py-2">
                View Full Schedule →
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Fundraising Section */}
      <section className="py-20 bg-gradient-to-br from-verde-50 to-salsa-50 dark:from-verde-950/20 dark:to-salsa-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Image */}
              <div className="flex justify-center lg:justify-start">
                <div className="relative w-72 lg:w-96" style={{ aspectRatio: '1000 / 733' }}>
                  <Image
                    src="/images/shared/fundraising-icon.png"
                    alt="Jose Madrid Salsa Fundraising"
                    fill
                    className="object-contain drop-shadow-xl"
                    sizes="(max-width: 768px) 288px, 384px"
                  />
                </div>
              </div>
              {/* Content */}
              <div>
                <span className="inline-block text-sm font-semibold uppercase tracking-widest text-salsa-600 mb-3">
                  Earn 50% Profit
                </span>
                <h2 className="text-4xl font-bold font-serif text-foreground mb-6">
                  Fundraise With <span className="text-gradient">Jose!</span>
                </h2>
                <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                  Looking for a fundraiser people actually want to buy? Our premium handcrafted salsas sell themselves — over 25 unique flavors, free shipping on bulk orders, and a <strong className="text-foreground">50% profit margin</strong> for your school, team, or organization.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    '50% profit on every jar sold',
                    'Pre-sell & online fundraising options',
                    'Free shipping on 96+ jar orders',
                    'Ships within 10 days of order',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-foreground">
                      <span className="w-5 h-5 rounded-full bg-verde-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/fundraising"
                    className="btn-primary text-base px-8 py-3 text-center"
                  >
                    Learn More
                  </Link>
                  <Link
                    href="/auth/fundraiser-signup"
                    className="btn-secondary text-base px-8 py-3 text-center"
                  >
                    Start Your Fundraiser
                  </Link>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Active Fundraising Campaigns — team mascots */}
      <ErrorBoundary>
        <ActiveCampaignsGrid
          limit={6}
          heading="Teams Fundraising Right Now"
          subheading="Meet the schools, clubs, and teams raising money with Jose Madrid Salsa. Back a team and every jar counts toward their goal."
          className="bg-background"
        />
      </ErrorBoundary>

      {/* Gift Box Selector Section */}
      <GiftBoxSelector />

      {/* Location Map Section */}
      <LocationMapClient />

      {/* Reviews Section — data pre-fetched server-side, zero client API calls */}
      <AnimatedTestimonials reviewsData={reviewsData} />

      {/* CTA Section */}
      <section className="py-20 bg-salsa-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Taste the Difference?
          </h2>
          <p className="text-xl text-salsa-100 mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers who have made Jose Madrid Salsa their go-to choice.
          </p>
          <Link href="/salsas" className="btn-secondary text-lg px-8 py-4 bg-white text-salsa-600 hover:bg-gray-100">
            Shop All Salsas
          </Link>
        </div>
      </section>
    </main>
    </ErrorBoundary>
  )
}
