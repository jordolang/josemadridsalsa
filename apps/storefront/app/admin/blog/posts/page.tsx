import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import prisma from '@/lib/prisma'
import type { Prisma, BlogPostStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface SearchParams {
  status?: string
  series?: string
  category?: string
  q?: string
}

interface PageProps {
  searchParams: Promise<SearchParams>
}

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SCHEDULED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  PUBLISHED: 'bg-verde-100 text-verde-800 dark:bg-verde-900/40 dark:text-verde-200',
  ARCHIVED: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'ARCHIVED', label: 'Archived' },
]

function buildFilterHref(
  current: SearchParams,
  patch: Partial<SearchParams>
): string {
  const merged = { ...current, ...patch }
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) {
    if (v && v !== 'ALL') params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `/admin/blog/posts?${qs}` : '/admin/blog/posts'
}

export default async function AdminPostsListPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const status = sp.status ?? 'ALL'
  const seriesSlug = sp.series ?? ''
  const categorySlug = sp.category ?? ''
  const q = (sp.q ?? '').trim()

  const where: Prisma.BlogPostWhereInput = {
    ...(status !== 'ALL' ? { status: status as BlogPostStatus } : {}),
    ...(seriesSlug ? { series: { slug: seriesSlug } } : {}),
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
            { excerpt: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [posts, allSeries, allCategories] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        featured: true,
        layout: true,
        publishedAt: true,
        updatedAt: true,
        coverImage: true,
        readingMinutes: true,
        series: { select: { slug: true, name: true } },
        category: { select: { slug: true, name: true } },
      },
    }),
    prisma.blogSeries.findMany({ orderBy: { name: 'asc' }, select: { slug: true, name: true } }),
    prisma.blogCategory.findMany({ orderBy: { name: 'asc' }, select: { slug: true, name: true } }),
  ])

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link
        href="/admin/blog"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to The Heat Index dashboard
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

      <form
        action="/admin/blog/posts"
        method="get"
        className="rounded-2xl border border-border bg-card p-4 mb-6 space-y-3"
      >
        <div className="flex flex-wrap gap-2 items-center">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={buildFilterHref(sp, { status: f.key })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                status === f.key
                  ? 'border-salsa-600 bg-salsa-600 text-white'
                  : 'border-border bg-background hover:border-foreground/30'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search title, slug, excerpt…"
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <select
            name="series"
            defaultValue={seriesSlug}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All series</option>
            {allSeries.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            name="category"
            defaultValue={categorySlug}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {allCategories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
          <button
            type="submit"
            className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-semibold hover:opacity-90"
          >
            Filter
          </button>
        </div>
      </form>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="text-muted-foreground">No posts match these filters.</p>
          <Link
            href="/admin/blog/posts/new"
            className="inline-flex items-center gap-2 mt-4 rounded-md bg-salsa-600 hover:bg-salsa-700 text-white px-4 py-2 text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Write a new post
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
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5 ${STATUS_TONE[p.status]}`}
                    >
                      {p.status}
                    </span>
                    {p.featured && (
                      <Badge variant="secondary" className="text-[10px]">
                        Featured
                      </Badge>
                    )}
                    {p.layout !== 'STANDARD' && (
                      <span className="text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5 bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                        {p.layout}
                      </span>
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
