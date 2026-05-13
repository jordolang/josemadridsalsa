import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SCHEDULED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  PUBLISHED: 'bg-verde-100 text-verde-800 dark:bg-verde-900/40 dark:text-verde-200',
  ARCHIVED: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
}

export default async function AdminPostsListPage() {
  const posts = await prisma.blogPost.findMany({
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      featured: true,
      publishedAt: true,
      updatedAt: true,
      coverImage: true,
      readingMinutes: true,
      series: { select: { name: true } },
      category: { select: { name: true } },
    },
  })

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link
        href="/admin/blog"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Heat Index dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Posts</h1>
        <Link
          href="/admin/blog/posts/new"
          className="inline-flex items-center gap-2 rounded-md bg-salsa-600 hover:bg-salsa-700 text-white px-4 py-2 text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" />
          New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="text-muted-foreground">No posts yet.</p>
          <Link
            href="/admin/blog/posts/new"
            className="inline-flex items-center gap-2 mt-4 rounded-md bg-salsa-600 hover:bg-salsa-700 text-white px-4 py-2 text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Write the first one
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/blog/posts/${p.slug}`}
                className="grid grid-cols-[64px_1fr_auto] gap-4 items-center p-4 hover:bg-muted/50 transition"
              >
                <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted">
                  {p.coverImage && (
                    <Image
                      src={p.coverImage}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5 ${STATUS_TONE[p.status]}`}>
                      {p.status}
                    </span>
                    {p.featured && (
                      <Badge variant="secondary" className="text-[10px]">
                        Featured
                      </Badge>
                    )}
                    {p.category && (
                      <span className="text-xs text-muted-foreground">{p.category.name}</span>
                    )}
                    {p.series && (
                      <span className="text-xs text-muted-foreground">· {p.series.name}</span>
                    )}
                  </div>
                  <p className="font-semibold truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    /heat-index/{p.slug}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>
                    {p.publishedAt
                      ? new Date(p.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </div>
                  <div>{p.readingMinutes} min</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
