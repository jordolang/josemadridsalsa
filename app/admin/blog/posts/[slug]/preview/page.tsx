import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BlogContent } from '@/components/heat-index/blog-content'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function AdminBlogPreviewPage({ params }: PageProps) {
  const { slug } = await params
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    include: {
      category: true,
      series: true,
    },
  })

  if (!post) notFound()

  const formattedDate = (post.publishedAt ?? post.updatedAt)
    ? new Date(post.publishedAt ?? post.updatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <main className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b border-border bg-yellow-50 dark:bg-yellow-950 px-4 py-2 flex items-center gap-3 text-sm text-yellow-800 dark:text-yellow-200">
        <span className="font-semibold uppercase tracking-wide text-xs">Preview</span>
        <span className="text-yellow-600 dark:text-yellow-400">
          Status: <strong>{post.status}</strong>
        </span>
        <Link
          href={`/admin/blog/posts/${slug}`}
          className="ml-auto text-yellow-700 dark:text-yellow-300 hover:underline"
        >
          ← Back to editor
        </Link>
      </div>

      <article className="container mx-auto px-4 py-12 lg:py-20">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/heat-index"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to The Heat Index
          </Link>

          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {post.category && (
                <span className="inline-flex items-center rounded-full bg-salsa-100 text-salsa-700 dark:bg-salsa-900/40 dark:text-salsa-300 px-3 py-1 text-xs font-bold uppercase tracking-widest">
                  {post.category.name}
                </span>
              )}
              {post.series && (
                <span
                  className="inline-flex items-center rounded-full bg-card border border-border px-3 py-1 text-xs font-bold uppercase tracking-widest"
                  style={post.series.accentColor ? { color: post.series.accentColor } : undefined}
                >
                  {post.series.name}
                  {post.seriesOrder ? ` · Part ${post.seriesOrder}` : ''}
                </span>
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
                  <time>{formattedDate}</time>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {post.readingMinutes} min read
              </div>
            </div>
          </header>

          {post.layout === 'VIDEO' && post.videoUrl ? (
            <div className="relative aspect-video rounded-2xl overflow-hidden mb-10 shadow-md bg-black">
              <video
                src={post.videoUrl}
                poster={post.coverImage ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full"
              />
            </div>
          ) : post.layout === 'MINIMAL' ? null : post.coverImage ? (
            <div
              className={`relative ${
                post.layout === 'LONGFORM' ? 'aspect-[2/1]' : 'aspect-[16/9]'
              } rounded-2xl overflow-hidden mb-10 shadow-md`}
            >
              <Image
                src={post.coverImage}
                alt={post.coverImageAlt ?? post.title}
                fill
                sizes="(max-width: 768px) 100vw, 1024px"
                className="object-cover"
                priority
              />
            </div>
          ) : null}

          {post.layout === 'GALLERY' && post.galleryImages.length > 0 && (
            <div className="mb-10 grid grid-cols-2 md:grid-cols-3 gap-3">
              {post.galleryImages.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative aspect-square rounded-lg overflow-hidden bg-muted shadow-sm"
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          <div
            className={
              post.layout === 'LONGFORM'
                ? 'prose-xl first-letter:text-7xl first-letter:font-serif first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:leading-[0.85] first-letter:text-salsa-700'
                : ''
            }
          >
            <BlogContent content={post.content} />
          </div>

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-10 pt-6 border-t border-border">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </article>
    </main>
  )
}
