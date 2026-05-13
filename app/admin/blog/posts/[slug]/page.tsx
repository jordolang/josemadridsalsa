import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PostEditor } from '@/components/admin/blog/post-editor'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function EditPostPage({ params }: PageProps) {
  const { slug } = await params
  const [post, series, categories] = await Promise.all([
    prisma.blogPost.findUnique({ where: { slug } }),
    prisma.blogSeries.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    prisma.blogCategory.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
  ])

  if (!post) notFound()

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link
        href="/admin/blog/posts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to posts
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit post</h1>
        <p className="text-sm text-muted-foreground">/heat-index/{post.slug}</p>
      </div>
      <PostEditor
        mode="edit"
        series={series}
        categories={categories}
        initial={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          subtitle: post.subtitle,
          excerpt: post.excerpt,
          content: post.content,
          coverImage: post.coverImage,
          coverImageAlt: post.coverImageAlt,
          status: post.status,
          scheduledFor: post.scheduledFor?.toISOString() ?? null,
          featured: post.featured,
          readingMinutes: post.readingMinutes,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          tags: post.tags,
          seriesId: post.seriesId,
          seriesOrder: post.seriesOrder,
          categoryId: post.categoryId,
        }}
      />
    </div>
  )
}
