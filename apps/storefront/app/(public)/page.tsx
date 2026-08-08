import Image from 'next/image'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { createMetadata } from '@/lib/metadata'
import { getCachedSeoConfiguration } from '@/lib/seo/configuration'
import { OrganizationJsonLd } from '@/components/seo/organization-jsonld'
import { LocationMapClient } from '@/components/store/location-map-client'
import { getReviewsData, getCalendarEvents } from '@/lib/server/google-data'
import { ActiveCampaignsGrid } from '@/components/fundraiser/active-campaigns-grid'
import { ScrollVideoHeroHome } from '@/components/store/scroll-video-hero-home'
import { getPageContent } from '@/lib/cms/queries'
import { homeHeroPanels } from '@/lib/cms/home'
import { FeaturedProductsSection } from '@/components/store/featured-products-section'
import { FeaturedHeatIndexSection } from '@/components/store/featured-heat-index-section'

export const dynamic = 'force-dynamic'

// Lazy load heavy below-the-fold components
const AnimatedTestimonials = nextDynamic(
  () => import('@/components/store/animated-testimonials').then(mod => ({ default: mod.AnimatedTestimonials })),
  { loading: () => <div className="h-96 animate-pulse bg-muted rounded-lg" /> }
)

const GiftBoxSelector = nextDynamic(
  () => import('@/components/store/gift-box-selector').then(mod => ({ default: mod.GiftBoxSelector })),
  { loading: () => <div className="h-96 animate-pulse bg-muted rounded-lg" /> }
)

const ScheduleMapWrapper = nextDynamic(
  () => import('@/components/store/schedule-map-wrapper').then(mod => ({ default: mod.ScheduleMapWrapper })),
  { loading: () => <div className="h-[520px] animate-pulse bg-muted rounded-3xl" /> }
)

export async function generateMetadata(): Promise<Metadata> {
  const base = createMetadata({
    title: 'Jose Madrid Salsa - Premium Gourmet Salsa',
    description:
      'Premium handcrafted salsa from Zanesville, Ohio — 25+ small-batch flavors from mild to fiery hot, family-owned since 1987.',
    pathname: '/',
  })

  // Google Search Console HTML-tag verification, configured in /admin/seo
  const seoConfig = await getCachedSeoConfiguration()
  if (seoConfig?.googleSiteVerification) {
    base.verification = { google: seoConfig.googleSiteVerification }
  }

  return base
}

const CATEGORY_TILES = [
  {
    href: '/products?heat=mild',
    eyebrow: 'Mild & Sweet',
    title: 'Mild',
    body: 'Perfect for those who enjoy flavor without the heat. Great for kids and mild palates.',
    icon: '🌿',
    tone: 'verde' as const,
  },
  {
    href: '/products?heat=medium',
    eyebrow: 'Medium Heat',
    title: 'Medium',
    body: 'The perfect balance of flavor and heat. Our most popular choice for everyday enjoyment.',
    icon: '🌶️',
    tone: 'chile' as const,
  },
  {
    href: '/products?heat=hot',
    eyebrow: 'Hot & Spicy',
    title: 'Hot',
    body: 'For those who love the heat — bold flavors with a serious kick that builds with each bite.',
    icon: '🔥',
    tone: 'salsa' as const,
  },
]

const TONE_BG = {
  verde: 'bg-verde-100 dark:bg-verde-900/40',
  chile: 'bg-chile-100 dark:bg-chile-900/40',
  salsa: 'bg-salsa-100 dark:bg-salsa-900/30',
}

const FUNDRAISING_STATS = [
  { value: '50%', label: 'Profit per jar' },
  { value: '96+', label: 'Jar minimum' },
  { value: '10 days', label: 'Ship time' },
] as const

// This is an async server component — it fetches ONCE on the server at render time.
// Next.js ISR caches the result (reviews: 2h, calendar: 5min).
// Zero Google API calls happen in the browser on load. The Refresh button
// on the schedule map is the only path that ever triggers a client fetch.
export default async function Home() {
  // Fetch all data in parallel — reviews and calendar
  const [reviewsData, calendarEvents, content] = await Promise.all([
    getReviewsData(),
    getCalendarEvents(),
    // CMS overrides for this page. Every lookup below supplies the original
    // copy as its fallback, so an unedited homepage is byte-for-byte unchanged.
    getPageContent('home'),
  ])

  return (
    <ErrorBoundary>
      <main className="min-h-screen">
        {/* Organization JSON-LD for rich results */}
        <OrganizationJsonLd />

        {/* Hero — video scrubs frame-by-frame as the page scrolls; copy sits in
            a left column over a left-edge legibility gradient */}
        <ScrollVideoHeroHome panels={homeHeroPanels(content)} />

        {/* Opaque white separator that also LIFTS the products area above the
            hero. The hero is a positioned, isolated stacking context, so a plain
            (static) bar would still paint beneath the pinned video. `relative
            z-10 bg-background` paints this block — and the products inside it —
            over the hero, so the video can never bleed behind the store text. */}
        <div className="relative z-10 bg-background">
          <div aria-hidden className="h-8 sm:h-12" />
          {/* Featured Products — pulled from Prisma (isFeatured=true, inStock=true) */}
          {content.isVisible('featuredProducts') && (
            <ErrorBoundary>
              <FeaturedProductsSection limit={content.number('featuredProducts', 'limit', 4)} />
            </ErrorBoundary>
          )}
        </div>

        {/* Fundraising — moved up to sit right below the products display */}
        {content.isVisible('fundraisingPromo') && (
        <section className="relative overflow-hidden bg-gradient-to-br from-verde-50 to-salsa-50 py-12 sm:py-16 md:py-20 dark:from-verde-950/20 dark:to-salsa-950/20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="grid grid-cols-1 items-center gap-8 sm:gap-12 lg:grid-cols-2">
                <div>
                  <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-salsa-600">
                    Earn 50% Profit
                  </span>
                  <h2 className="mb-4 font-serif text-3xl sm:text-4xl font-bold leading-tight tracking-[-0.02em] text-foreground md:text-5xl">
                    {content.text('fundraisingPromo', 'heading') || (
                      <>
                        Fundraise With <span className="text-gradient">Jose!</span>
                      </>
                    )}
                  </h2>
                  <p className="mb-6 max-w-md text-base sm:text-lg leading-relaxed text-muted-foreground">
                    {content.text(
                      'fundraisingPromo',
                      'body',
                      'Looking for a fundraiser people actually want to buy? Our premium handcrafted salsas sell themselves — trusted by 500+ schools, teams, and nonprofits.'
                    )}
                  </p>

                  {/* Punchy 3-up stat blocks with Volkhov numerals */}
                  <dl className="mb-7 grid grid-cols-3 gap-2 sm:gap-4">
                    {FUNDRAISING_STATS.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center surface-shadow"
                      >
                        <dt className="sr-only">{stat.label}</dt>
                        <dd className="font-serif text-xl sm:text-2xl font-bold text-salsa-600">{stat.value}</dd>
                        <p className="mt-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </dl>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/fundraising"
                      className="inline-flex items-center gap-2 rounded-full bg-salsa-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-salsa-600 hover:shadow-[0_4px_12px_rgba(229,62,62,0.4)]"
                    >
                      Start Your Fundraiser
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/auth/fundraiser-signup"
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-salsa-300 hover:shadow-md"
                    >
                      Download Brochure
                    </Link>
                  </div>
                </div>

                <div className="relative flex justify-center lg:justify-start">
                  <div className="relative w-56 sm:w-72 lg:w-96" style={{ aspectRatio: '1000 / 733' }}>
                    <Image
                      src="/images/shared/fundraising-icon.png"
                      alt="Jose Madrid Salsa Fundraising"
                      fill
                      className="object-contain drop-shadow-xl"
                      sizes="(max-width: 640px) 224px, (max-width: 768px) 288px, 384px"
                    />
                  </div>
                  {/* Floating "average raised" badge — signature kit element */}
                  <div className="absolute right-0 top-0 sm:-right-2 sm:-top-4 rotate-3 rounded-2xl bg-salsa-500 p-3 sm:p-4 text-white shadow-xl lg:-right-4">
                    <div className="font-serif text-xl sm:text-2xl font-bold leading-tight">$3,500+</div>
                    <div className="text-[10px] sm:text-xs">average raised</div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
        )}

        {/* Heat-Level Categories */}
        {content.isVisible('heatLevels') && (
        <section className="bg-muted/30 py-12 sm:py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="mb-12 sm:mb-16 text-center">
                <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-salsa-600">
                  Heat Levels
                </span>
                <h2 className="mb-4 font-serif text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-foreground md:text-5xl">
                  {content.text('heatLevels', 'heading') || (
                    <>
                      Built for Every <span className="text-gradient">Palate</span>
                    </>
                  )}
                </h2>
                <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground">
                  {content.text(
                    'heatLevels',
                    'body',
                    'From those who like it mild to the heat seekers — we have the perfect salsa for everyone.'
                  )}
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {CATEGORY_TILES.map((tile, idx) => (
                <ScrollReveal key={tile.href} delay={100 * (idx + 1)}>
                  <Link
                    href={tile.href}
                    className="interactive-card group block rounded-xl border border-border bg-card p-8 text-center"
                  >
                    <div
                      className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${TONE_BG[tile.tone]} transition-transform duration-300 group-hover:scale-110`}
                    >
                      <span className="text-3xl" aria-hidden>
                        {tile.icon}
                      </span>
                    </div>
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-salsa-600">
                      {tile.eyebrow}
                    </span>
                    <h3 className="mb-4 font-serif text-2xl font-bold text-foreground">
                      {tile.title}
                    </h3>
                    <p className="mb-6 text-muted-foreground">{tile.body}</p>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-salsa-600 transition-all duration-200 group-hover:gap-3">
                      Shop {tile.title}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
        )}

        {/* Featured Blog — newest Heat Index stories */}
        {content.isVisible('heatIndex') && (
          <ErrorBoundary>
            <FeaturedHeatIndexSection />
          </ErrorBoundary>
        )}

        {/* What Sets Us Apart */}
        {content.isVisible('whatSetsUsApart') && (
        <section className="py-12 sm:py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-12 sm:gap-16 lg:grid-cols-2">
              <ScrollReveal className="scroll-reveal-left">
                <div>
                  <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-salsa-600">
                    What Sets Us Apart
                  </span>
                  <h2 className="mb-6 font-serif text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-foreground">
                    More Than Just <span className="text-gradient">Great Taste</span>
                  </h2>
                  <div className="space-y-6 sm:space-y-8">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-lg bg-salsa-100 dark:bg-salsa-900/30">
                        <span className="text-lg sm:text-xl text-salsa-600" aria-hidden>🏪</span>
                      </div>
                      <div>
                        <h3 className="mb-2 text-lg sm:text-xl font-semibold text-foreground">Fundraising Made Easy</h3>
                        <p className="text-sm sm:text-base text-muted-foreground">
                          Perfect for schools, churches, and organizations. High-profit margins and products people actually want.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-lg bg-verde-100 dark:bg-verde-900/30">
                        <span className="text-lg sm:text-xl text-verde-600" aria-hidden>🏭</span>
                      </div>
                      <div>
                        <h3 className="mb-2 text-lg sm:text-xl font-semibold text-foreground">Wholesale Options</h3>
                        <p className="text-sm sm:text-base text-muted-foreground">
                          Stock our premium salsas in your store. Competitive pricing with excellent support.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-lg bg-chile-100 dark:bg-chile-900/30">
                        <span className="text-lg sm:text-xl text-chile-600" aria-hidden>📍</span>
                      </div>
                      <div>
                        <h3 className="mb-2 text-lg sm:text-xl font-semibold text-foreground">Local Presence</h3>
                        <p className="text-sm sm:text-base text-muted-foreground">
                          Find us at local stores throughout Ohio, or order online for delivery anywhere.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal className="scroll-reveal-right">
                <div className="relative">
                  <div className="relative h-64 sm:h-80 md:h-96 w-full lg:h-[500px]">
                    <Image
                      src="/images/shared/salsa-bowl.png"
                      alt="Fresh ingredients for salsa"
                      fill
                      className="rounded-2xl object-contain"
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 45vw, 40vw"
                    />
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>
        )}

        {/* Where Is Jose — Live Schedule Map */}
        {content.isVisible('whereIsJose') && (
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="mx-auto mb-8 sm:mb-10 max-w-3xl text-center">
                <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-salsa-600">
                  On the Move
                </span>
                <h2 className="mb-4 font-serif text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-foreground">
                  Where Is <span className="text-gradient">Jose?</span>
                </h2>
                <p className="text-base sm:text-lg text-muted-foreground">
                  Follow Jose Madrid Salsa to farmers markets, retail demos, and special events — updated live from our calendar.
                </p>
              </div>
              <ScheduleMapWrapper initialEvents={calendarEvents} />
              <div className="mt-6 text-center">
                <Link
                  href="/where-is-jose"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-2 text-sm font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-salsa-300 hover:shadow-md"
                >
                  View Full Schedule
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
        )}

        {/* Active Fundraising Campaigns — team mascots */}
        {content.isVisible('activeCampaigns') && (
          <ErrorBoundary>
            <ActiveCampaignsGrid
              limit={6}
              heading={content.text(
                'activeCampaigns',
                'heading',
                'Teams Fundraising Right Now'
              )}
              subheading={content.text(
                'activeCampaigns',
                'body',
                'Meet the schools, clubs, and teams raising money with Jose Madrid Salsa. Back a team and every jar counts toward their goal.'
              )}
              className="bg-background"
            />
          </ErrorBoundary>
        )}

        {/* Gift Box Selector Section */}
        {content.isVisible('giftBoxes') && <GiftBoxSelector />}

        {/* Location Map Section */}
        {content.isVisible('locationMap') && <LocationMapClient />}

        {/* Reviews Section — data pre-fetched server-side, zero client API calls */}
        <AnimatedTestimonials reviewsData={reviewsData} />

        {/* CTA — hero gradient, eyebrow, serif + text-gradient accent */}
        <section className="hero-gradient relative overflow-hidden py-12 sm:py-16 md:py-20 text-white">
          <div aria-hidden className="absolute inset-0 bg-black/15" />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-chile-200">
              Made With Love, Served With Pride
            </span>
            <h2 className="mb-5 font-serif text-3xl sm:text-4xl font-bold leading-tight tracking-[-0.02em] md:text-5xl">
              Ready to Taste the
              <span className="block italic text-chile-200">Difference?</span>
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-base sm:text-lg text-white/90 leading-relaxed">
              Join thousands of families who made Jose Madrid Salsa their go-to jar.
              From Mike&apos;s kitchen in Zanesville, Ohio — straight to your table.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-salsa-600 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-stone-100 hover:shadow-xl"
            >
              Shop All Salsas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </ErrorBoundary>
  )
}
