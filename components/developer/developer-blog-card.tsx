import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Calendar } from 'lucide-react'

interface DeveloperBlogCardProps {
  slug: string
  title: string
  excerpt: string
  coverImage?: string | null
  tags: string[]
  publishedAt: string | null
}

export function DeveloperBlogCard({
  slug,
  title,
  excerpt,
  coverImage,
  tags,
  publishedAt,
}: DeveloperBlogCardProps) {
  const formattedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <Link
      href={`/developer/blog/${slug}`}
      className="group block rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
    >
      {coverImage && (
        <div className="relative aspect-[16/9] overflow-hidden">
          <Image
            src={coverImage}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}

      <div className="p-6">
        {formattedDate && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-3">
            <Calendar className="w-3.5 h-3.5" />
            <time dateTime={publishedAt!}>{formattedDate}</time>
          </div>
        )}

        <h3 className="text-lg font-bold text-foreground mb-2 line-clamp-2 group-hover:text-salsa-600 transition-colors">
          {title}
        </h3>

        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-4">
          {excerpt}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
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
