import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'
import { DeveloperBlogCard } from '@/components/developer/developer-blog-card'
import prisma from '@/lib/prisma'

export const metadata: Metadata = {
  ...createMetadata({
    title: 'Developer Blog | Jose Madrid Salsa',
    description:
      'Behind-the-scenes stories, technical deep-dives, and lessons learned while building the Jose Madrid Salsa platform.',
    pathname: '/developer/blog',
    keywords: ['developer blog', 'Jose Madrid Salsa', 'web development', 'Next.js', 'tech blog'],
  }),
  alternates: {
    canonical: 'https://www.josemadrid.net/developer/blog',
  },
}

interface BlogListItem {
  id: string
  slug: string
  title: string
  excerpt: string
  coverImage: string | null
  tags: string[]
  publishedAt: Date | null
}

async function getPublishedPosts(): Promise<BlogListItem[]> {
  return prisma.developerBlogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      coverImage: true,
      tags: true,
      publishedAt: true,
    },
  })
}

export default async function DeveloperBlogPage() {
  const posts = await getPublishedPosts()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 lg:py-20">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/developer"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Developer
          </Link>

          <div className="text-center mb-12">
            <h1 className="text-3xl lg:text-5xl font-serif font-bold text-foreground mb-4">
              Developer Blog
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Behind-the-scenes stories, technical deep-dives, and lessons learned
              while building this platform.
            </p>
          </div>

          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
              <p className="text-muted-foreground font-medium text-lg">
                No blog posts yet
              </p>
              <p className="text-muted-foreground/60 text-sm mt-2">
                Check back soon for stories from the development journey.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <DeveloperBlogCard
                  key={post.id}
                  slug={post.slug}
                  title={post.title}
                  excerpt={post.excerpt}
                  coverImage={post.coverImage}
                  tags={post.tags}
                  publishedAt={post.publishedAt?.toISOString() ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
