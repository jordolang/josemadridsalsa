import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock, Flame } from 'lucide-react'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { getLatestPosts, type PostCard as PostCardData } from '@/lib/blog/queries'
import { logger } from '@/lib/logger'

const CARD_TONES = [
  {
    className: 'lg:row-span-2 lg:min-h-[500px]',
    imageSizes: '(max-width: 1024px) 100vw, 50vw',
    gradient: 'from-salsa-950/95 via-salsa-800/68 to-amber-600/42',
  },
  {
    className: 'lg:min-h-[240px]',
    imageSizes: '(max-width: 1024px) 100vw, 50vw',
    gradient: 'from-stone-950/94 via-salsa-900/68 to-verde-800/36',
  },
  {
    className: 'lg:min-h-[240px]',
    imageSizes: '(max-width: 1024px) 100vw, 50vw',
    gradient: 'from-stone-950/94 via-amber-800/64 to-salsa-700/38',
  },
] as const

function formatDate(d: Date | string | null): string | null {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function HeatIndexBentoCard({
  post,
  index,
}: {
  post: PostCardData
  index: number
}) {
  const tone = CARD_TONES[index] ?? CARD_TONES[0]
  const date = formatDate(post.publishedAt)
  const isFeature = index === 0
  const imageSrc = post.coverImage ?? 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/site/images/shared/salsa-bowl.webp'

  return (
    <Link
      href={`/heat-index/${post.slug}`}
      className="group relative isolate flex h-full min-h-[320px] overflow-hidden rounded-3xl border border-white/40 bg-stone-950 text-white shadow-[0_24px_70px_rgba(69,10,10,0.22)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_32px_90px_rgba(69,10,10,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-salsa-500"
    >
      <Image
        src={imageSrc}
        alt={post.coverImageAlt ?? post.title}
        fill
        className={`object-cover transition duration-700 group-hover:scale-105 ${
          post.coverImage ? 'opacity-82' : 'object-contain p-10 opacity-42'
        }`}
        sizes={tone.imageSizes}
      />
      <div className={`absolute inset-0 bg-gradient-to-br ${tone.gradient}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.34),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.16),transparent_36%,rgba(255,255,255,0.08))]" />
      <div className="absolute -bottom-20 -right-16 h-48 w-48 rounded-full bg-white/12 blur-2xl transition duration-700 group-hover:scale-125" />

      <div className="relative z-10 flex h-full w-full flex-col justify-between p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full border border-white/35 bg-white/16 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-white backdrop-blur-md">
            {post.category?.name ?? post.series?.name ?? 'The Heat Index'}
          </span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/16 backdrop-blur-md">
            <Flame className="h-4 w-4" />
          </span>
        </div>

        <div className={isFeature ? 'max-w-xl' : 'max-w-md'}>
          {date && (
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/76">
              <Clock className="h-3.5 w-3.5" />
              <time dateTime={post.publishedAt?.toISOString?.() ?? undefined}>
                {date}
              </time>
            </div>
          )}
          <h3
            className={`font-serif font-bold leading-tight tracking-[-0.03em] text-white ${
              isFeature ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'
            }`}
          >
            {post.title}
          </h3>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/84 sm:text-base">
            {post.excerpt}
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white transition-all group-hover:gap-3">
            Read story
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export async function FeaturedHeatIndexSection() {
  let posts: PostCardData[] = []

  try {
    posts = await getLatestPosts({ take: 3 })
  } catch (error) {
    logger.error('Failed to load featured Heat Index posts', { error })
    return null
  }

  if (posts.length === 0) return null

  return (
    <section className="relative overflow-hidden border-y border-salsa-900/10 bg-[#fff8ef] py-20 dark:border-white/10 dark:bg-stone-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(213,48,48,0.18),transparent_28%),radial-gradient(circle_at_88%_0%,rgba(22,163,74,0.14),transparent_24%)] dark:bg-[radial-gradient(circle_at_12%_10%,rgba(213,48,48,0.22),transparent_28%),radial-gradient(circle_at_88%_0%,rgba(22,163,74,0.12),transparent_24%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="mb-12 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <span className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-salsa-600">
                <Flame className="h-4 w-4" />
                Featured Blog
              </span>
              <h2 className="font-serif text-4xl font-bold tracking-[-0.02em] text-foreground md:text-5xl">
                Fresh From <span className="text-gradient">The Heat Index</span>
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
                The three newest stories from the kitchen, the road, and the Jose Madrid salsa archive.
              </p>
            </div>
            <Link
              href="/heat-index"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-salsa-300 hover:shadow-md"
            >
              Read The Heat Index
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </ScrollReveal>

        <div className="grid gap-5 lg:grid-cols-2 lg:grid-rows-2">
          {posts.map((post, index) => (
            <ScrollReveal
              key={post.id}
              className={CARD_TONES[index]?.className}
              delay={100 * index}
            >
              <HeatIndexBentoCard post={post} index={index} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
