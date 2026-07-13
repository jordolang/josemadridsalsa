import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'
import { PostCard } from '@/components/heat-index/post-card'
import { SubscribeForm } from '@/components/heat-index/subscribe-form'
import { getSeriesBySlug, getSeriesPostsOrdered } from '@/lib/blog/queries'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'


export const revalidate = 300

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  try {
    const series = await prisma.blogSeries.findMany({ select: { slug: true } })
    return series.map((s) => ({ slug: s.slug }))
  } catch (error) {
    console.warn('[heat-index/series/[slug]] generateStaticParams: DB unreachable', error)
    return []
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const series = await getSeriesBySlug(slug)
  if (!series) return { title: 'Series Not Found | The Heat Index' }
  return {
    ...createMetadata({
      title: `${series.name} | The Heat Index`,
      description: series.description ?? series.tagline ?? `An ongoing series in The Heat Index.`,
      pathname: `/heat-index/series/${series.slug}`,
    }),
    alternates: {
      canonical: `https://www.josemadrid.net/heat-index/series/${series.slug}`,
    },
  }
}

export default async function SeriesPage({ params }: PageProps) {
  const { slug } = await params
  const series = await getSeriesBySlug(slug)
  if (!series) notFound()

  const posts = await getSeriesPostsOrdered(series.id)
  const accent = series.accentColor ?? '#c0392b'

  return (
    <main className="min-h-screen bg-background">
      {/* Series hero */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{
          background: `linear-gradient(135deg, ${accent}22 0%, transparent 60%)`,
        }}
      >
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <Link
            href="/heat-index"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to The Heat Index
          </Link>

          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 items-center">
            <div>
              <div
                className="inline-flex items-center gap-2 mb-4 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-white"
                style={{ backgroundColor: accent }}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Series · {posts.length} {posts.length === 1 ? 'post' : 'posts'}
              </div>
              <h1 className="font-serif font-bold text-5xl lg:text-7xl text-foreground leading-[1.05] tracking-tight mb-6">
                {series.name}
              </h1>
              {series.tagline && (
                <p className="text-xl lg:text-2xl italic text-muted-foreground mb-6">
                  {series.tagline}
                </p>
              )}
              {series.description && (
                <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
                  {series.description}
                </p>
              )}
            </div>
            {series.coverImage && (
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg">
                <Image
                  src={series.coverImage}
                  alt={series.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Posts in order */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
              <p className="text-muted-foreground font-medium text-lg">No chapters yet</p>
              <p className="text-muted-foreground/60 text-sm mt-2">
                Subscribe below and we'll let you know when the first one drops.
              </p>
            </div>
          ) : (
            <ol className="space-y-8">
              {posts.map((post, i) => (
                <li key={post.id} className="grid gap-6 sm:grid-cols-[80px_1fr] items-start">
                  <div
                    className="hidden sm:flex flex-col items-center justify-center rounded-2xl border-2 p-4 text-center"
                    style={{ borderColor: accent }}
                  >
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
                      Part
                    </span>
                    <span className="font-serif font-bold text-3xl text-foreground">{i + 1}</span>
                  </div>
                  <PostCard post={post} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* Subscribe to this series */}
      <section className="container mx-auto px-4 pb-20">
        <div className="max-w-4xl mx-auto">
          <SubscribeForm
            seriesSlug={series.slug}
            source={`heat-index-series-${series.slug}`}
            heading={`Follow "${series.name}"`}
            description="Subscribe and we'll send you every new chapter as it goes live."
          />
        </div>
      </section>
    </main>
  )
}
