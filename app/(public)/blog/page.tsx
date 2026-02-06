import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Newspaper, User, Calendar, ArrowRight } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Taste of Zanesville Blog - Jose Madrid Salsa',
  description: 'Discover stories, tips, and updates from local Zanesville businesses, craftsmen, chefs, and the Jose Madrid Salsa community. Your hub for all things local.',
  pathname: '/blog',
  keywords: ['Zanesville blog', 'local business', 'community', 'Jose Madrid Salsa', 'Ohio', 'small business'],
})

type SearchParams = {
  page?: string
  category?: string
}

const BLOG_CATEGORIES = [
  'Business Tips',
  'Community News',
  'Food & Recipes',
  'Local Events',
  'Craftsmanship',
  'Small Business Spotlight',
  'Health & Wellness',
  'Behind the Scenes',
  'General',
]

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const category = params.category || ''
  const limit = 12
  const skip = (page - 1) * limit

  const where: any = {
    status: 'PUBLISHED',
    publishedAt: { not: null },
  }

  if (category) {
    where.category = category
  }

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      skip,
      take: limit,
      orderBy: { publishedAt: 'desc' },
      include: {
        author: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.blogPost.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 rounded-full bg-salsa-50 px-4 py-1.5 text-sm font-medium text-salsa-700 mb-4 dark:bg-salsa-950 dark:text-salsa-300">
          <Newspaper className="h-4 w-4" />
          Community Blog
        </div>
        <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">
          Taste of Zanesville
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Stories, tips, and updates from local Zanesville businesses, craftsmen, chefs,
          and the Jose Madrid Salsa community. Your hub for everything local.
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        <Link href="/blog">
          <Badge
            variant={!category ? 'default' : 'outline'}
            className={!category ? 'bg-salsa-500 hover:bg-salsa-600' : 'hover:bg-slate-100'}
          >
            All Posts
          </Badge>
        </Link>
        {BLOG_CATEGORIES.map((cat) => (
          <Link key={cat} href={`/blog?category=${encodeURIComponent(cat)}`}>
            <Badge
              variant={category === cat ? 'default' : 'outline'}
              className={category === cat ? 'bg-salsa-500 hover:bg-salsa-600' : 'hover:bg-slate-100'}
            >
              {cat}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <Card className="p-12 text-center">
          <Newspaper className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h2 className="text-xl font-medium mb-2">No Posts Yet</h2>
          <p className="text-muted-foreground mb-4">
            {category
              ? `No posts found in the "${category}" category.`
              : 'Be the first to share your story with the Zanesville community!'}
          </p>
          <Link href="/auth/signup">
            <Button className="bg-salsa-500 hover:bg-salsa-600">
              Join & Start Writing
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow group">
                  {post.featuredImage && (
                    <div className="relative h-48 bg-slate-100">
                      <Image
                        src={post.featuredImage}
                        alt={post.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                  )}
                  {!post.featuredImage && (
                    <div className="h-48 bg-gradient-to-br from-salsa-50 to-chile-50 dark:from-salsa-950 dark:to-chile-950 flex items-center justify-center">
                      <Newspaper className="h-12 w-12 text-salsa-300" />
                    </div>
                  )}
                  <div className="p-4">
                    {post.category && (
                      <Badge variant="outline" className="mb-2 text-xs">
                        {post.category}
                      </Badge>
                    )}
                    <h2 className="font-semibold text-lg mb-2 group-hover:text-salsa-600 transition-colors line-clamp-2">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{post.author.name || 'Anonymous'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {post.publishedAt
                            ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {page > 1 && (
                <Link
                  href={`/blog?page=${page - 1}${category ? `&category=${encodeURIComponent(category)}` : ''}`}
                >
                  <Button variant="outline">Previous</Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground px-4">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/blog?page=${page + 1}${category ? `&category=${encodeURIComponent(category)}` : ''}`}
                >
                  <Button variant="outline">Next</Button>
                </Link>
              )}
            </div>
          )}
        </>
      )}

      {/* CTA Section */}
      <Card className="mt-12 p-8 text-center bg-gradient-to-r from-salsa-50 to-chile-50 dark:from-salsa-950 dark:to-chile-950 border-salsa-200 dark:border-salsa-800">
        <h2 className="text-2xl font-serif font-bold mb-2">Share Your Story</h2>
        <p className="text-muted-foreground mb-4 max-w-lg mx-auto">
          Are you a local business owner, craftsman, or chef in Zanesville? Join our community
          blog and share your story with thousands of local readers. It&apos;s free!
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/auth/signup">
            <Button className="bg-salsa-500 hover:bg-salsa-600">
              Create an Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
