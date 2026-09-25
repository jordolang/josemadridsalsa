import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Tag } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'
import { PostCard } from '@/components/heat-index/post-card'
import { getCategoryBySlug } from '@/lib/blog/queries'
import { postCardSelect } from '@/lib/blog/queries'
import prisma from '@/lib/prisma'
import { SITE_URL } from '@/lib/site-url'



export const revalidate = 300

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  try {
    const cats = await prisma.blogCategory.findMany({ select: { slug: true } })
    return cats.map((c) => ({ slug: c.slug }))
  } catch (error) {
    console.warn('[heat-index/category/[slug]] generateStaticParams: DB unreachable', error)
    return []
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const cat = await getCategoryBySlug(slug)
  if (!cat) return { title: 'Category Not Found | The Heat Index' }
  return {
    ...createMetadata({
      title: `${cat.name} | The Heat Index`,
      description:
        cat.description ?? `Stories in the ${cat.name} category from The Heat Index.`,
      pathname: `/heat-index/category/${cat.slug}`,
    }),
    alternates: {
      canonical: `${SITE_URL}/heat-index/category/${cat.slug}`,
    },
  }
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) notFound()

  const posts = await prisma.blogPost.findMany({
    where: {
      categoryId: category.id,
      status: 'PUBLISHED',
      publishedAt: { lte: new Date() },
    },
    orderBy: { publishedAt: 'desc' },
    select: postCardSelect,
  })

  const accent = category.accentColor ?? '#c0392b'

  return (
    <main className="min-h-screen bg-background">
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ background: `linear-gradient(135deg, ${accent}22 0%, transparent 60%)` }}
      >
        <div className="container mx-auto px-4 py-14 lg:py-20">
          <Link
            href="/heat-index"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to The Heat Index
          </Link>
          <div
            className="inline-flex items-center gap-2 mb-4 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-white"
            style={{ backgroundColor: accent }}
          >
            <Tag className="w-3.5 h-3.5" />
            Category
          </div>
          <h1 className="font-serif font-bold text-5xl lg:text-7xl text-foreground leading-[1.05] tracking-tight mb-4">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              {category.description}
            </p>
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        {posts.length === 0 ? (
          <div className="max-w-3xl mx-auto rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
            <p className="text-muted-foreground font-medium text-lg">Nothing here yet</p>
            <p className="text-muted-foreground/60 text-sm mt-2">
              Check back soon — or browse <Link href="/heat-index" className="text-salsa-600 underline">all stories</Link>.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
