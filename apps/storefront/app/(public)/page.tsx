import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Heart,
  Play,
  ShoppingCart,
  Swords,
  Trophy,
  Users,
} from 'lucide-react'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { createMetadata } from '@/lib/metadata'
import { getCachedSeoConfiguration } from '@/lib/seo/configuration'
import { OrganizationJsonLd } from '@/components/seo/organization-jsonld'
import { HomePageView } from '@/components/analytics/home-page-view'
import { loadHomepageProducts } from '@/components/store/featured-products-section'
import { HomeBoothTile } from '@/components/store/home-booth-tile'
import { AwardSeal } from '@/components/store/award-seal'
import { AwardsStrip } from '@/components/store/awards-strip'
import { BATTLE_ARENA_URL } from '@/lib/arena-game/links'
import { logger } from '@/lib/logger'

export const revalidate = 300

const PLATES = '/images/home/redesign'

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

const VALUE_CARDS: Array<{
  photo: string
  alt: string
  icon: LucideIcon
  title: string
  body: string
  link: { label: string; href: string }
}> = [
  {
    photo: 'card-family-photo',
    alt: 'A family in cowboy hats watching the sunset over a field',
    icon: Users,
    title: 'Family Values',
    body: 'Generations of tradition, quality and a love for great food.',
    link: { label: 'Learn More', href: '/our-story' },
  },
  {
    photo: 'card-awards-photo',
    alt: 'Gold medals and ribbons on a shelf',
    icon: Trophy,
    title: 'Award Winning Recipes',
    body: 'Crafted with the finest ingredients. Recognized for exceptional flavor.',
    link: { label: 'Our Awards', href: '#awards' },
  },
  {
    photo: 'card-community-photo',
    alt: 'Many hands stacked together in a team huddle',
    icon: Heart,
    title: 'Community Fundraising',
    body: 'Help your local community raise money for the causes that matter.',
    link: { label: 'Partner With Us', href: '/fundraising' },
  },
]

const COMMUNITY_TILES = [
  {
    photo: 'tile-fundraising-photo',
    alt: 'Volunteers holding a Support Local Fundraisers sign',
    title: 'Fundraising Channels',
    body: 'Multiple ways to raise funds. Support your cause with great salsa!',
    cta: { label: 'Explore Options', href: '/fundraising' },
  },
  {
    photo: 'tile-map-photo',
    alt: 'A road map with event pins and our trailer',
    title: 'Where Is Jose?',
    body: 'Follow Jose on the road! Find us at upcoming events, festivals and local stops.',
    cta: { label: 'View Map', href: '/where-is-jose' },
  },
  {
    photo: 'tile-merch-photo',
    alt: 'Jose Madrid Salsa t-shirts and a cap',
    title: 'Merchandise',
    body: 'Wear the flavor. Show your support. Official Jose Madrid Salsa gear.',
    cta: { label: 'Shop Merch', href: '/merchandise' },
  },
  {
    photo: 'tile-social-photo',
    alt: 'A phone showing the Jose Madrid Salsa Facebook page over a road map',
    title: 'Stay Connected',
    body: 'Get the latest news, events, new products, fundraising opportunities and more.',
    cta: { label: 'Join Our Family', href: '#join-our-family' },
  },
]

// Real jar cutouts on disk (the kiosk's flavor art). A catalog product whose name
// matches one shows its cutout on the wood band; anything else uses its photo.
const JAR_CUTOUTS = new Set([
  'black-bean-corn-poblano', 'blueberry', 'cherry-chocolate-hot', 'cherry-hot', 'cherry-mild',
  'chipotle-con-queso', 'chipotle-hot', 'cilantro-hot', 'cilantro-mild', 'clovis-medium',
  'ghost-of-clovis', 'green-apple', 'jamaican-jerk', 'mango-habanero', 'mango-mild',
  'original-hot', 'original-mild', 'original-x-hot', 'peach-mild', 'pineapple-mild',
  'raspberry-bbq-chipotle', 'raspberry-mild', 'roasted-garlic-olives', 'roasted-pineapple-habanero',
  'spanish-verde-hot', 'spanish-verde-mild', 'spanish-verde-xx-hot', 'strawberry-mild',
])

function jarCutoutFor(name: string): string | null {
  const key = name
    .toLowerCase()
    .replace(/jose madrid|salsa/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return JAR_CUTOUTS.has(key) ? `/images/kiosk/jar-${key}.webp` : null
}

const HEAT_LABELS: Record<string, string> = {
  MILD: 'Mild',
  MEDIUM: 'Medium',
  HOT: 'Hot',
  EXTRA_HOT: 'Extra Hot',
  FRUIT: 'Fruit',
}

// Shown when the catalog returns nothing, so the shop band never empties.
const FALLBACK_JARS = [
  { name: 'Original', heat: 'Mild', image: '/images/kiosk/jar-original-mild.webp', href: '/products?heatLevel=MILD' },
  { name: 'Roasted Garlic & Olives', heat: 'Medium', image: '/images/kiosk/jar-roasted-garlic-olives.webp', href: '/products?heatLevel=MEDIUM' },
  { name: 'Original', heat: 'Hot', image: '/images/kiosk/jar-original-hot.webp', href: '/products?heatLevel=HOT' },
  { name: 'Spanish Verde', heat: 'Mild', image: '/images/kiosk/jar-spanish-verde-mild.webp', href: '/products?heatLevel=MILD' },
]

async function loadShopJars() {
  try {
    const { products } = await loadHomepageProducts(4)
    if (products.length > 0) {
      return products.map((p) => ({
        name: p.name.replace(/^jose madrid\s+/i, ''),
        heat: HEAT_LABELS[p.heatLevel] ?? '',
        image: jarCutoutFor(p.name) ?? p.featuredImage ?? '/images/placeholder-salsa.jpg',
        href: `/salsas/${p.slug}`,
      }))
    }
  } catch (err) {
    logger.error('Failed to load homepage shop jars', { error: err })
  }
  return FALLBACK_JARS
}

const goldButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] bg-desert-sun-gold px-6 font-western text-sm font-semibold uppercase tracking-[0.08em] text-night-ink transition-colors hover:bg-desert-sun-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'
const outlineButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] border border-white/80 px-6 font-western text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:border-desert-sun-gold hover:text-desert-sun-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-desert-sun-gold'

export default async function Home() {
  const shopJars = await loadShopJars()

  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-night-earth text-white">
        <OrganizationJsonLd />
        <HomePageView />

        {/* Hero — the rider at sunset and five real jars on a smoldering log, looping */}
        <section aria-labelledby="home-hero-title" className="relative isolate overflow-hidden">
          {/* The still is the fallback: it shows while the video loads, if it fails, and
              for visitors who ask for reduced motion (the video is hidden for them) */}
          <Image
            src={`${PLATES}/hero-poster.webp`}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-[72%_50%] md:object-center"
          />
          <video
            aria-hidden
            className="absolute inset-0 -z-20 h-full w-full object-cover object-[72%_50%] motion-reduce:hidden md:object-center"
            src={`${PLATES}/hero-loop.mp4`}
            poster={`${PLATES}/hero-poster.webp`}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
          {/* Legibility scrim: dark behind the copy column, clear over the rider */}
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/40 to-transparent md:via-black/25" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
          {/* Phones: copy runs full width across the sun, so darken the whole frame */}
          <div aria-hidden className="absolute inset-0 -z-10 bg-black/35 md:hidden" />

          <div className="relative mx-auto max-w-[1400px] px-5 pb-6 pt-12 sm:px-8 md:flex md:min-h-[clamp(580px,46vw,720px)] md:items-center md:pb-16 md:pt-16 lg:px-12">
            <div className="relative z-20 max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85 lg:whitespace-nowrap">
                Real Ingredients <span aria-hidden className="mx-1.5 text-white/40">|</span> Time-Honored Recipes{' '}
                <span aria-hidden className="mx-1.5 text-white/40">|</span> Stronger Communities
              </p>
              <h1
                id="home-hero-title"
                className="font-western mt-4 text-[clamp(2.4rem,4.3vw,4rem)] font-bold uppercase leading-[0.98] tracking-[0.01em]"
              >
                More Than Salsa…
                <span className="block text-desert-sun-gold">It&apos;s a Family Tradition.</span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-white/90">
                Award-winning recipes, made with love, tradition and a commitment to our family — and yours.
                When you purchase Jose Madrid Salsa, you&apos;re not just getting incredible flavor, you&apos;re
                supporting local communities and making a real difference.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/products" className={goldButton}>
                  <ShoppingCart aria-hidden className="h-4 w-4" />
                  Shop Our Salsas
                </Link>
                <Link href="/our-story" className={outlineButton}>
                  <Play aria-hidden className="h-3.5 w-3.5 fill-current" />
                  Our Story
                </Link>
              </div>
            </div>

          </div>

          {/* Award seal — the confirmed national awards (PRODUCT.md) */}
          <AwardSeal className="absolute right-4 top-6 z-20 hidden h-40 w-36 sm:block md:right-[4%] md:top-[7%] lg:right-[4%] lg:top-[5%] lg:h-44 lg:w-40" />

          <p
            aria-hidden
            className="font-script pointer-events-none absolute bottom-16 right-6 z-20 hidden -rotate-6 text-5xl leading-none text-desert-sun-gold drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] xl:block"
          >
            Salsa
            <br />
            <span className="ml-8">Kings</span>
          </p>
        </section>

        {/* The three confirmed national awards (PRODUCT.md); the seal is hidden on phones */}
        <AwardsStrip />

        {/* Values — three photo cards on the night ground */}
        <section aria-label="What we stand for" className="border-t border-white/5 bg-night-earth py-10 sm:py-12">
          <ul className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-5 sm:px-8 md:grid-cols-3 lg:px-12">
            {VALUE_CARDS.map((card) => (
              <li key={card.title} className="flex flex-col overflow-hidden border border-white/15 bg-[#0d0b0a]">
                <div className="relative aspect-[3/1]">
                  <Image src={`${PLATES}/${card.photo}.webp`} alt={card.alt} fill sizes="(min-width: 768px) 30vw, 92vw" className="object-cover" />
                </div>
                <div className="relative flex flex-1 gap-4 px-5 pb-6 pt-8">
                  <span className="absolute -top-7 left-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-desert-sun-gold bg-[#0d0b0a] text-desert-sun-gold">
                    <card.icon aria-hidden className="h-6 w-6" />
                  </span>
                  <div className="pl-16">
                    <h2 className="font-western text-lg font-semibold uppercase tracking-[0.08em]">{card.title}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/75">{card.body}</p>
                    <Link
                      href={card.link.href}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-desert-sun-gold hover:text-desert-sun-gold-light"
                    >
                      {card.link.label}
                      <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Shop band — real jars on barn wood, the booth tile, and the arena */}
        <section
          aria-labelledby="shop-heading"
          className="border-y border-desert-sun-gold/25 bg-[#2a1a10] bg-repeat"
          style={{ backgroundImage: `url('${PLATES}/wood-texture.webp')`, backgroundSize: '440px auto' }}
        >
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.55fr)_minmax(0,0.55fr)] lg:items-center lg:px-12 lg:py-12">
            <div>
              <h2 id="shop-heading" className="font-western text-[clamp(2rem,3.4vw,2.9rem)] font-bold uppercase tracking-[0.04em]">
                Shop Our Salsas
              </h2>
              <p className="font-serif mt-1 text-lg text-white/85">Find your flavor. Share the tradition.</p>
              <ErrorBoundary>
                <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
                  {shopJars.map((jar) => (
                    <li key={jar.href + jar.name + jar.heat}>
                      <Link href={jar.href} className="group block text-center">
                        <span className="relative mx-auto block aspect-[3/4] w-full max-w-[150px]">
                          <Image
                            src={jar.image}
                            alt={`${jar.name} salsa jar`}
                            fill
                            sizes="(min-width: 640px) 150px, 40vw"
                            className="object-contain drop-shadow-[0_14px_14px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transition-none"
                          />
                        </span>
                        <span className="font-western mt-3 block text-sm font-semibold uppercase tracking-[0.06em] group-hover:text-desert-sun-gold">
                          {jar.name}
                        </span>
                        {jar.heat && <span className="block text-xs text-white/70">{jar.heat}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </ErrorBoundary>
              <div className="mt-7 text-center sm:text-left lg:pl-[30%]">
                <Link href="/products" className={goldButton}>
                  Shop All Salsas
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <HomeBoothTile />

            <div className="flex flex-col items-center bg-night-earth/85 px-6 py-8 text-center ring-1 ring-white/10">
              <Swords aria-hidden className="h-12 w-12 text-desert-sun-gold" />
              <h2 className="font-western mt-3 text-3xl font-bold uppercase tracking-[0.04em]">Battle Arena</h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.3em] text-desert-sun-gold">
                Play · Earn · Win
              </p>
              <p className="mt-4 text-sm leading-relaxed text-white/80">
                Test your salsa knowledge, complete challenges and unlock rewards in the Jose Madrid Salsa
                Battle Arena.
              </p>
              <a
                href={BATTLE_ARENA_URL}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-desert-sun-gold px-5 font-western text-sm font-semibold uppercase tracking-[0.08em] text-desert-sun-gold transition-colors hover:bg-desert-sun-gold hover:text-night-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Enter the Arena
                <ArrowRight aria-hidden className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Community tiles on parchment */}
        <section
          aria-label="Get involved"
          className="bg-[#f1e6d0] bg-repeat py-10 sm:py-12"
          style={{ backgroundImage: `url('${PLATES}/cream-band.webp')` }}
        >
          <ul className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 px-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-12">
            {COMMUNITY_TILES.map((tile) => (
              <li key={tile.title} className="flex flex-col overflow-hidden bg-night-earth shadow-[0_10px_24px_rgba(40,25,10,0.25)]">
                <div className="relative aspect-[229/118]">
                  <Image src={`${PLATES}/${tile.photo}.webp`} alt={tile.alt} fill sizes="(min-width: 1024px) 23vw, (min-width: 640px) 46vw, 92vw" className="object-cover" />
                </div>
                <div className="flex flex-1 flex-col items-center px-5 pb-6 pt-5 text-center">
                  <h2 className="font-western text-lg font-semibold uppercase tracking-[0.08em]">{tile.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-white/75">{tile.body}</p>
                  <Link
                    href={tile.cta.href}
                    className="mt-4 inline-flex min-h-11 w-full max-w-[240px] items-center justify-center gap-2 rounded-[3px] border border-white/80 px-4 font-western text-sm font-semibold uppercase tracking-[0.08em] transition-colors hover:border-desert-sun-gold hover:text-desert-sun-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-desert-sun-gold"
                  >
                    {tile.cta.label}
                    <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </ErrorBoundary>
  )
}
