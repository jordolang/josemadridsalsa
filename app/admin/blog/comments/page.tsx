import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CommentsModerator } from '@/components/admin/blog/comments-moderator'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface SearchParams {
  filter?: string
}

interface PageProps {
  searchParams: Promise<SearchParams>
}

const FILTERS: { key: string; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'HIDDEN', label: 'Hidden' },
  { key: 'SPAM', label: 'Spam' },
  { key: 'ALL', label: 'All' },
]

export default async function AdminCommentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filter = params.filter ?? 'PENDING'

  const where = filter === 'ALL' ? {} : { status: filter as 'PENDING' | 'APPROVED' | 'HIDDEN' | 'SPAM' }

  const rows = await prisma.blogComment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
      post: { select: { slug: true, title: true } },
    },
  })

  const initial = rows.map((r) => ({
    id: r.id,
    body: r.body,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    user: r.user,
    post: r.post,
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
      <h1 className="text-2xl font-bold mb-2">Comment moderation</h1>
      <p className="text-sm text-muted-foreground mb-6">
        New comments default to <strong>Pending</strong> and are invisible to readers until approved.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'PENDING' ? '/admin/blog/comments' : `/admin/blog/comments?filter=${f.key}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
              filter === f.key
                ? 'border-salsa-600 bg-salsa-600 text-white'
                : 'border-border bg-card hover:border-foreground/30'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <CommentsModerator initial={initial} />
    </div>
  )
}
