import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PostEditor } from '@/components/admin/blog/post-editor'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function NewPostPage() {
  const [series, categories] = await Promise.all([
    prisma.blogSeries.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.blogCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link
        href="/admin/blog/posts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to posts
      </Link>
      <h1 className="text-2xl font-bold mb-6">New post</h1>
      <PostEditor mode="create" series={series} categories={categories} />
    </div>
  )
}
