import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Flame, Rss, Tag } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'
import { PostCard } from '@/components/heat-index/post-card'
import { SubscribeForm } from '@/components/heat-index/subscribe-form'
import {
  getAllCategories,
  getFeaturedPost,
  getFeaturedSeries,
  getLatestPosts,
  type PostCard as PostCardData,
} from '@/lib/blog/queries'

export const revalidate = 300

export const metadata: Metadata = {
  ...createMetadata({
    title: 'Heat Index | Jose Madrid Salsa',
    description:
      'The Jose Madrid Salsa magazine: stories, recipes, road notes, and salsa lore. Updated regularly.',
    pathname: '/heat-index',
    keywords: [
      'Jose Madrid Salsa blog',
      'salsa recipes',
      'salsa stories',
      'Zanesville Ohio',
      'Clovis New Mexico',
    ],
  }),
  alternates: {
    canonical: 'https://www.josemadrid.net/heat-index',
    types: { 'application/rss+xml': '/heat-index/rss.xml' },
  },
}

interface BentoPost {
  post: PostCardData
  className: string
  accentFrom: string
  accentTo: string
}

const BENTO_LAYOUT: Pick<BentoPost, 'className' | 'accentFrom' | 'accentTo'>[] = [
  { className: 'lg:col-span-2 lg:row-span-2', accentFrom: 'from-salsa-700', accentTo: 'to-amber-500' },
  { className: 'lg:col-span-1', accentFrom: 'from-zinc-950', accentTo: 'to-salsa-800' },
  { className: 'lg:col-span-1', accentFrom: 'from-amber-700', accentTo: 'to-salsa-600' },
  { className: 'lg:col-span-1', accentFrom: 'from-verde-800', accentTo: 'to-amber-500' },
  { className: 'lg:col-span-1', accentFrom: 'from-stone-950', accentTo: 'to-salsa-700' },
]

function BentoStoryCard({ post, className, accentFrom, accentTo }: BentoPost) {
  return (
    <Link
      href={`/heat-index/${post.slug}`}
      className={`group relative isolate min-h-[320px] overflow-hidden rounded-lg border border-white/30 bg-stone-950 text-white shadow-[0_28px_70px_rgba(69,10,10,0.24)] ${className}`}
    >
      {post.coverImage && (
        <Image
          src={post.coverImage}
          alt={post.coverImageAlt ?? ''}
          fill
          className="object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-95"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      )}
      <div className={`absolute inset-0 bg-gradient-to-br ${accentFrom} ${accentTo} opacity-78 mix-blend-multiply`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.34),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.16),transparent_36%,rgba(255,255,255,0.08))]" />

      <div className="relative z-10 flex h-full min-h-[320px] flex-col justify-between p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-sm border border-white/40 bg-white/18 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white backdrop-blur-md">
            {post.category?.name ?? post.series?.name ?? 'Heat Index'}
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-white/16 backdrop-blur-md">
            <Flame className="h-4 w-4" />
          </span>
        </div>

        <div className="max-w-xl">
          <h2 className="font-serif text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">
            {post.title}
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-white/85 sm:text-base line-clamp-3">
            {post.excerpt}
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-white">
            Read the story
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default async function HeatIndexPage() {
  const [featured, latest, series, categories] = await Promise.all([
    getFeaturedPost(),
    getLatestPosts({ take: 12 }),
    getFeaturedSeries(4),
    getAllCategories(),
  ])

  // Build bento board: featured first (largest), then up to 4 most recent non-featured
  const featuredId = featured?.id
  const bentoBase: PostCardData[] = [
    ...(featured ? [featured] : []),
    ...latest.filter((p) => p.id !== featuredId),
  ].slice(0, 5)

  const bentoStories: BentoPost[] = bentoBase.map((post, i) => ({
    post,
    ...BENTO_LAYOUT[i],
  }))

  // Posts below the bento (older / not in bento)
  const moreStories = latest.filter((p) => !bentoStories.some((b) => b.post.id === p.id)).slice(0, 8)

  return (
    <main className="min-h-screen overflow-hidden bg-[#fff8ef] text-stone-950 dark:bg-stone-950 dark:text-stone-50">
      {/* Masthead */}
      <section className="relative border-b border-salsa-900/10 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(213,48,48,0.22),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(22,163,74,0.16),transparent_24%),linear-gradient(180deg,rgba(255,251,235,0.92),rgba(255,248,239,1))] dark:bg-[radial-gradient(circle_at_15%_10%,rgba(213,48,48,0.34),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(22,163,74,0.18),transparent_24%),linear-gradient(180deg,rgba(69,10,10,0.72),rgba(28,25,23,1))]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-salsa-700/20 bg-white/60 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-salsa-700 shadow-sm backdrop-blur dark:bg-white/10 dark:text-salsa-200">
              <Flame className="h-4 w-4" />
              Jose Madrid Magazine
            </div>
            <h1 className="font-serif text-6xl font-bold tracking-[-0.04em] text-salsa-950 sm:text-7xl lg:text-8xl dark:text-white">
              Heat Index
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-700 dark:text-stone-200">
              Stories, recipes, road notes, and salsa lore from the team behind Jose Madrid Salsa.
              New posts from the kettle, the kitchen, and wherever the salsa is travelling this week.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/heat-index/category/${c.slug}`}
                  className="rounded-sm border border-salsa-900/15 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-stone-800 shadow-sm transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white"
                  style={
                    c.accentColor
                      ? { borderLeftWidth: 3, borderLeftColor: c.accentColor }
                      : undefined
                  }
                >
                  {c.name}
                  <span className="ml-2 text-stone-400">{c._count.posts}</span>
                </Link>
              ))}
              <Link
                href="/heat-index/rss.xml"
                className="inline-flex items-center gap-1.5 rounded-sm border border-salsa-900/15 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-stone-800 shadow-sm transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white"
              >
                <Rss className="h-3.5 w-3.5" />
                RSS
              </Link>
            </div>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-white/40 bg-salsa-950 shadow-[0_30px_80px_rgba(69,10,10,0.28)]">
            <Image
              src="/images/shared/salsa-bowl.png"
              alt="Fresh salsa bowl with tomatoes and peppers"
              fill
              priority
              className="object-contain object-center p-8"
              sizes="(max-width: 1024px) 100vw, 45vw"
            />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(69,10,10,0.12),rgba(213,48,48,0.24),rgba(245,158,11,0.18))]" />
            <div className="absolute bottom-5 left-5 right-5 rounded-md border border-white/35 bg-white/16 p-4 text-white backdrop-blur-md">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/75">
                Current reading
              </p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <p className="font-serif text-4xl font-bold">Hot &amp; Rising</p>
                <Flame className="mb-2 h-6 w-6 fill-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento board of featured + latest */}
      {bentoStories.length > 0 && (
        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-salsa-700 dark:text-salsa-300">
                  On the front page
                </p>
                <h2 className="mt-2 font-serif text-4xl font-bold tracking-[-0.03em]">
                  What we're putting out this week.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-stone-600 dark:text-stone-300">
                Fresh dispatches from the kettle, the kitchen, the road, and the office.
              </p>
            </div>

            <div className="grid auto-rows-[minmax(320px,auto)] grid-cols-1 gap-5 lg:grid-cols-4">
              {bentoStories.map((s) => (
                <BentoStoryCard key={s.post.id} {...s} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Storylines / series */}
      {series.length > 0 && (
        <section className="border-y border-salsa-900/10 bg-white/58 px-4 py-14 backdrop-blur dark:border-white/10 dark:bg-white/5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-salsa-700 dark:text-salsa-300">
                  Ongoing storylines
                </p>
                <h2 className="mt-2 font-serif text-4xl font-bold tracking-[-0.03em]">
                  Series to follow.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-stone-600 dark:text-stone-300">
                Each storyline gets its own ongoing thread. Subscribe to a series to get every new chapter.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {series.map((s) => (
                <Link
                  key={s.id}
                  href={`/heat-index/series/${s.slug}`}
                  className="group rounded-lg border border-stone-900/10 bg-[#fffaf2] p-6 shadow-[0_16px_42px_rgba(69,10,10,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_60px_rgba(69,10,10,0.12)] dark:border-white/10 dark:bg-stone-900"
                  style={
                    s.accentColor
                      ? { borderTopWidth: 4, borderTopColor: s.accentColor }
                      : undefined
                  }
                >
                  <div className="flex items-baseline justify-between">
                    <p
                      className="text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={
                        s.accentColor
                          ? { color: s.accentColor }
                          : { color: 'rgb(185 28 28)' }
                      }
                    >
                      Series
                    </p>
                    <span className="text-xs text-stone-500 dark:text-stone-400">
                      {s._count.posts} {s._count.posts === 1 ? 'post' : 'posts'}
                    </span>
                  </div>
                  <h3 className="mt-3 font-serif text-3xl font-bold group-hover:text-salsa-600 transition-colors">
                    {s.name}
                  </h3>
                  {s.tagline && (
                    <p className="mt-2 italic text-stone-600 dark:text-stone-300">{s.tagline}</p>
                  )}
                  {s.description && (
                    <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300 line-clamp-3">
                      {s.description}
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-salsa-700 group-hover:gap-2 transition-all dark:text-salsa-300">
                    Read the series
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* More stories */}
      {moreStories.length > 0 && (
        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-salsa-700 dark:text-salsa-300">
                  <Tag className="inline w-3 h-3 mr-1" />
                  More from the Heat Index
                </p>
                <h2 className="mt-2 font-serif text-3xl lg:text-4xl font-bold tracking-[-0.03em]">
                  Keep reading.
                </h2>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {moreStories.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Subscribe */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <SubscribeForm />
        </div>
      </section>
    </main>
  )
}
