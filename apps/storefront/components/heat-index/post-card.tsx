import Link from 'next/link'
import Image from 'next/image'
import { Clock, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { PostCard as PostCardData } from '@/lib/blog/queries'

interface PostCardProps {
  post: PostCardData
  variant?: 'default' | 'compact'
}

function formatDate(d: Date | string | null): string | null {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function PostCard({ post, variant = 'default' }: PostCardProps) {
  const formatted = formatDate(post.publishedAt)
  const isCompact = variant === 'compact'

  return (
    <Link
      href={`/heat-index/${post.slug}`}
      className="group block rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-salsa-500"
    >
      {post.coverImage && (
        <div className={`relative overflow-hidden ${isCompact ? 'aspect-[3/2]' : 'aspect-[16/9]'}`}>
          <Image
            src={post.coverImage}
            alt={post.coverImageAlt ?? post.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {post.category && (
            <span
              className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur px-2.5 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm"
              style={post.category.accentColor ? { color: post.category.accentColor } : undefined}
            >
              <Tag className="w-3 h-3" />
              {post.category.name}
            </span>
          )}
        </div>
      )}

      <div className={isCompact ? 'p-5' : 'p-6'}>
        {post.series && (
          <div
            className="text-xs font-bold uppercase tracking-widest mb-2"
            style={post.series.accentColor ? { color: post.series.accentColor } : undefined}
          >
            {post.series.name}
            {post.seriesOrder ? ` · Part ${post.seriesOrder}` : ''}
          </div>
        )}

        <h3
          className={`font-serif font-bold text-foreground mb-2 line-clamp-2 group-hover:text-salsa-600 transition-colors ${
            isCompact ? 'text-lg' : 'text-xl lg:text-2xl'
          }`}
        >
          {post.title}
        </h3>

        {post.subtitle && !isCompact && (
          <p className="text-muted-foreground text-sm mb-3 line-clamp-2 italic">{post.subtitle}</p>
        )}

        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-4">
          {post.excerpt}
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <time dateTime={post.publishedAt?.toISOString?.() ?? undefined}>{formatted}</time>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {post.readingMinutes} min read
          </span>
        </div>

        {post.tags.length > 0 && !isCompact && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {post.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
