import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Calendar, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BlogContent } from '@/components/heat-index/blog-content'
import { PostCard } from '@/components/heat-index/post-card'
import { ShareButtons } from '@/components/heat-index/share-buttons'
import { ReactionBar } from '@/components/heat-index/reaction-bar'
import { CommentsSection } from '@/components/heat-index/comments-section'
import { SubscribeForm } from '@/components/heat-index/subscribe-form'
import { JsonLd } from '@/components/heat-index/json-ld'
import prisma from '@/lib/prisma'
import {
  getPostBySlug,
  getRelatedPosts,
  getSeriesPostsOrdered,
  type PostDetail,
} from '@/lib/blog/queries'

export const revalidate = 300

const SITE_URL = 'https://www.josemadrid.net'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const posts = await prisma.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    select: { slug: true },
  })
  return posts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return { title: 'Post Not Found | Heat Index' }

  const title = post.seoTitle ?? `${post.title} | Heat Index`
  const description = post.seoDescription ?? post.excerpt
  const url = `${SITE_URL}/heat-index/${post.slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      url,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      tags: post.tags,
      ...(post.coverImage
        ? { images: [{ url: post.coverImage, alt: post.coverImageAlt ?? post.title }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
  }
}

function reactionCountsByKind(
  reactions: PostDetail['reactions']
): Record<'FIRE' | 'HEART' | 'LAUGH' | 'MIND_BLOWN', number> {
  const counts = { FIRE: 0, HEART: 0, LAUGH: 0, MIND_BLOWN: 0 }
  for (const r of reactions) counts[r.kind] += 1
  return counts
}

interface CommentTreeNode {
  id: string
  body: string
  createdAt: string
  user: { name: string | null }
  parentId: string | null
  replies: CommentTreeNode[]
}

async function getApprovedCommentTree(postId: string): Promise<CommentTreeNode[]> {
  const flat = await prisma.blogComment.findMany({
    where: { postId, status: 'APPROVED' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      body: true,
      createdAt: true,
      parentId: true,
      user: { select: { name: true } },
    },
  })

  const byId = new Map<string, CommentTreeNode>()
  const roots: CommentTreeNode[] = []

  for (const c of flat) {
    byId.set(c.id, {
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
      parentId: c.parentId,
      replies: [],
    })
  }

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.replies.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export default async function PostDetailPage({ params }: PageProps) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) notFound()

  const [related, seriesPosts, comments] = await Promise.all([
    getRelatedPosts({
      id: post.id,
      seriesId: post.seriesId,
      categoryId: post.categoryId,
      tags: post.tags,
    }),
    post.seriesId ? getSeriesPostsOrdered(post.seriesId) : Promise.resolve([]),
    getApprovedCommentTree(post.id),
  ])

  const formattedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const url = `${SITE_URL}/heat-index/${post.slug}`
  const reactionCounts = reactionCountsByKind(post.reactions)

  let prevInSeries: (typeof seriesPosts)[number] | null = null
  let nextInSeries: (typeof seriesPosts)[number] | null = null
  if (post.seriesId && seriesPosts.length > 1) {
    const idx = seriesPosts.findIndex((p) => p.id === post.id)
    if (idx > 0) prevInSeries = seriesPosts[idx - 1]
    if (idx >= 0 && idx < seriesPosts.length - 1) nextInSeries = seriesPosts[idx + 1]
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': url,
    headline: post.title,
    description: post.excerpt,
    inLanguage: 'en-US',
    url,
    ...(post.publishedAt ? { datePublished: post.publishedAt.toISOString() } : {}),
    dateModified: post.updatedAt.toISOString(),
    ...(post.coverImage ? { image: post.coverImage } : {}),
    author: {
      '@type': 'Organization',
      name: 'Jose Madrid Salsa',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Jose Madrid Salsa',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/shared/jose-madrid-salsa-logo.png`,
      },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    keywords: post.tags.join(', '),
    ...(post.category ? { articleSection: post.category.name } : {}),
  }

  return (
    <main className="min-h-screen bg-background">
      <JsonLd data={jsonLd} />

      <article className="container mx-auto px-4 py-12 lg:py-20">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/heat-index"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Heat Index
          </Link>

          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {post.category && (
                <Link
                  href={`/heat-index/category/${post.category.slug}`}
                  className="inline-flex items-center rounded-full bg-salsa-100 text-salsa-700 dark:bg-salsa-900/40 dark:text-salsa-300 px-3 py-1 text-xs font-bold uppercase tracking-widest hover:bg-salsa-200 dark:hover:bg-salsa-900/60 transition"
                >
                  {post.category.name}
                </Link>
              )}
              {post.series && (
                <Link
                  href={`/heat-index/series/${post.series.slug}`}
                  className="inline-flex items-center rounded-full bg-card border border-border px-3 py-1 text-xs font-bold uppercase tracking-widest hover:border-salsa-300 transition"
                  style={post.series.accentColor ? { color: post.series.accentColor } : undefined}
                >
                  {post.series.name}
                  {post.seriesOrder ? ` · Part ${post.seriesOrder}` : ''}
                </Link>
              )}
            </div>

            <h1 className="text-4xl lg:text-6xl font-serif font-bold text-foreground mb-4 leading-tight tracking-tight">
              {post.title}
            </h1>

            {post.subtitle && (
              <p className="text-xl italic text-muted-foreground mb-6 leading-relaxed">
                {post.subtitle}
              </p>
            )}

            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">{post.excerpt}</p>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {formattedDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <time dateTime={post.publishedAt!.toISOString()}>{formattedDate}</time>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {post.readingMinutes} min read
              </div>
              <div className="ml-auto">
                <ShareButtons title={post.title} url={url} />
              </div>
            </div>
          </header>

          {post.coverImage && (
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 shadow-md">
              <Image
                src={post.coverImage}
                alt={post.coverImageAlt ?? post.title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                priority
              />
            </div>
          )}

          <BlogContent content={post.content} />

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-10 pt-6 border-t border-border">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-10">
            <ReactionBar postSlug={post.slug} initialCounts={reactionCounts} />
          </div>

          {(prevInSeries || nextInSeries) && post.series && (
            <nav className="mt-12 grid gap-4 sm:grid-cols-2">
              {prevInSeries ? (
                <Link
                  href={`/heat-index/${prevInSeries.slug}`}
                  className="group block rounded-2xl border border-border bg-card p-5 hover:border-salsa-300 transition"
                >
                  <span className="inline-flex items-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    Previous in {post.series.name}
                  </span>
                  <p className="font-serif font-bold text-lg text-foreground group-hover:text-salsa-600 transition-colors line-clamp-2">
                    {prevInSeries.title}
                  </p>
                </Link>
              ) : (
                <div />
              )}
              {nextInSeries ? (
                <Link
                  href={`/heat-index/${nextInSeries.slug}`}
                  className="group block rounded-2xl border border-border bg-card p-5 hover:border-salsa-300 transition sm:text-right"
                >
                  <span className="inline-flex items-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Next in {post.series.name}
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </span>
                  <p className="font-serif font-bold text-lg text-foreground group-hover:text-salsa-600 transition-colors line-clamp-2">
                    {nextInSeries.title}
                  </p>
                </Link>
              ) : null}
            </nav>
          )}

          <CommentsSection postSlug={post.slug} initialComments={comments} />
        </div>
      </article>

      {related.length > 0 && (
        <section className="border-t border-border bg-card/30">
          <div className="container mx-auto px-4 py-16">
            <div className="max-w-5xl mx-auto">
              <h2 className="font-serif font-bold text-3xl text-foreground mb-8 text-center">
                Keep reading
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {related.map((p) => (
                  <PostCard key={p.id} post={p} variant="compact" />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <SubscribeForm
            seriesSlug={post.series?.slug}
            heading={
              post.series
                ? `Follow "${post.series.name}"`
                : 'Get the Heat Index in your inbox'
            }
            description={
              post.series
                ? `Subscribe and we'll send you every new chapter in this series.`
                : 'Stories, recipes, and road notes — straight from the kettle. No spam, ever.'
            }
            source={post.series ? `heat-index-series-${post.series.slug}` : 'heat-index-post'}
          />
        </div>
      </section>
    </main>
  )
}
