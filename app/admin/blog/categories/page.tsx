import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CategoriesManager } from '@/components/admin/blog/categories-manager'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminBlogCategoriesPage() {
  const rows = await prisma.blogCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { posts: true } } },
  })

  const initial = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    accentColor: r.accentColor,
    sortOrder: r.sortOrder,
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
      <h1 className="text-2xl font-bold mb-6">Categories</h1>
      <CategoriesManager initial={initial} />
    </div>
  )
}
