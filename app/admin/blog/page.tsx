import Link from 'next/link'
import { FileText, BookOpen, Tag, MessageCircle, Plus, Flame } from 'lucide-react'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface StatTile {
  href: string
  label: string
  icon: typeof FileText
  value: number
  hint: string
}

export default async function AdminBlogHome() {
  const [posts, drafts, scheduled, series, categories, pendingComments] = await Promise.all([
    prisma.blogPost.count(),
    prisma.blogPost.count({ where: { status: 'DRAFT' } }),
    prisma.blogPost.count({ where: { status: 'SCHEDULED' } }),
    prisma.blogSeries.count(),
    prisma.blogCategory.count(),
    prisma.blogComment.count({ where: { status: 'PENDING' } }),
  ])

  const tiles: StatTile[] = [
    {
      href: '/admin/blog/posts',
      label: 'Posts',
      icon: FileText,
      value: posts,
      hint: `${drafts} draft · ${scheduled} scheduled`,
    },
    {
      href: '/admin/blog/series',
      label: 'Series',
      icon: BookOpen,
      value: series,
      hint: 'Storylines to follow',
    },
    {
      href: '/admin/blog/categories',
      label: 'Categories',
      icon: Tag,
      value: categories,
      hint: 'Top-level groupings',
    },
    {
      href: '/admin/blog/comments',
      label: 'Comments',
      icon: MessageCircle,
      value: pendingComments,
      hint: pendingComments > 0 ? 'Awaiting moderation' : 'Inbox clear',
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-salsa-600" />
            <h1 className="text-3xl font-bold">The Heat Index</h1>
          </div>
          <p className="text-muted-foreground">
            Author and manage the public-facing Jose Madrid Salsa blog.
          </p>
        </div>
        <Link
          href="/admin/blog/posts/new"
          className="inline-flex items-center gap-2 rounded-md bg-salsa-600 hover:bg-salsa-700 text-white px-4 py-2 text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" />
          New post
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        {tiles.map((t) => {
          const Icon = t.icon
          return (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-2xl border border-border bg-card p-5 hover:border-salsa-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between mb-3">
                <Icon className="w-6 h-6 text-muted-foreground group-hover:text-salsa-600 transition" />
                <span className="text-3xl font-bold tabular-nums">{t.value}</span>
              </div>
              <div className="font-semibold">{t.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.hint}</div>
            </Link>
          )
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold mb-3">Quick links</h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          <li><Link href="/heat-index" className="text-salsa-600 hover:underline" target="_blank" rel="noopener noreferrer">→ View The Heat Index (public)</Link></li>
          <li><Link href="/heat-index/rss.xml" className="text-salsa-600 hover:underline" target="_blank" rel="noopener noreferrer">→ View RSS feed</Link></li>
          <li><Link href="/admin/communications/lists" className="text-salsa-600 hover:underline">→ Subscriber lists</Link></li>
          <li><Link href="/admin/email-campaigns" className="text-salsa-600 hover:underline">→ Email campaigns</Link></li>
        </ul>
      </div>
    </div>
  )
}
