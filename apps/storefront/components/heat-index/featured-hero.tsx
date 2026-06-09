import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Clock } from 'lucide-react'
import type { PostCard as PostCardData } from '@/lib/blog/queries'

interface FeaturedHeroProps {
  post: PostCardData
}

export function FeaturedHero({ post }: FeaturedHeroProps) {
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <Link
      href={`/heat-index/${post.slug}`}
      className="group relative block overflow-hidden rounded-3xl border border-border bg-card shadow-md hover:shadow-xl transition-all duration-500"
    >
      <div className="grid md:grid-cols-2 gap-0">
        {post.coverImage && (
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[420px] overflow-hidden">
            <Image
              src={post.coverImage}
              alt={post.coverImageAlt ?? post.title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent md:hidden" />
          </div>
        )}

        <div className="p-8 md:p-12 lg:p-16 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center rounded-full bg-salsa-100 text-salsa-700 dark:bg-salsa-900/50 dark:text-salsa-300 px-3 py-1 text-xs font-bold uppercase tracking-widest">
              Featured
            </span>
            {post.series && (
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={post.series.accentColor ? { color: post.series.accentColor } : undefined}
              >
                {post.series.name}
              </span>
            )}
          </div>

          <h2 className="font-serif font-bold text-3xl md:text-4xl lg:text-5xl leading-tight text-foreground mb-4 group-hover:text-salsa-600 transition-colors">
            {post.title}
          </h2>

          {post.subtitle && (
            <p className="text-lg italic text-muted-foreground mb-5">{post.subtitle}</p>
          )}

          <p className="text-muted-foreground leading-relaxed mb-6 line-clamp-4">{post.excerpt}</p>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
            {date && <time dateTime={post.publishedAt?.toISOString?.() ?? undefined}>{date}</time>}
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {post.readingMinutes} min read
            </span>
          </div>

          <span className="inline-flex items-center gap-2 text-salsa-600 font-semibold group-hover:gap-3 transition-all">
            Read the story
            <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}
