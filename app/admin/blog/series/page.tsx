import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SeriesManager } from '@/components/admin/blog/series-manager'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminBlogSeriesPage() {
  const rows = await prisma.blogSeries.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { posts: true } } },
  })

  const initial = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    description: r.description,
    coverImage: r.coverImage,
    accentColor: r.accentColor,
    sortOrder: r.sortOrder,
    isFeatured: r.isFeatured,
    postCount: r._count.posts,
  }))

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link
        href="/admin/blog"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Heat Index dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-6">Series</h1>
      <SeriesManager initial={initial} />
    </div>
  )
}
