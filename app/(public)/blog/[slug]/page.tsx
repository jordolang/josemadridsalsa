import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar, User, Newspaper } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  const post = await prisma.blogPost.findUnique({
    where: { slug },
    select: {
      title: true,
      excerpt: true,
      metaTitle: true,
      metaDescription: true,
      featuredImage: true,
    },
  })

  if (!post) {
    return { title: 'Post Not Found' }
  }

  const title = post.metaTitle || `${post.title} - Taste of Zanesville Blog`
  const description = post.metaDescription || post.excerpt || `Read "${post.title}" on the Taste of Zanesville community blog.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: post.featuredImage ? [{ url: post.featuredImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: post.featuredImage ? [post.featuredImage] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params

  const post = await prisma.blogPost.findUnique({
    where: { slug },
    include: {
      author: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!post || post.status !== 'PUBLISHED') {
    notFound()
  }

  // Get related posts
  const relatedPosts = await prisma.blogPost.findMany({
    where: {
      status: 'PUBLISHED',
      id: { not: post.id },
      ...(post.category ? { category: post.category } : {}),
    },
    take: 3,
    orderBy: { publishedAt: 'desc' },
    select: {
      title: true,
      slug: true,
      excerpt: true,
      featuredImage: true,
      category: true,
      publishedAt: true,
      author: {
        select: { name: true },
      },
    },
  })

  // Split content into paragraphs for rendering
  const paragraphs = post.content.split('\n').filter((p) => p.trim())

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back button */}
      <Link href="/blog" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Taste of Zanesville Blog
      </Link>

      <article className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          {post.category && (
            <Link href={`/blog?category=${encodeURIComponent(post.category)}`}>
              <Badge variant="outline" className="mb-3 hover:bg-salsa-50">
                {post.category}
              </Badge>
            </Link>
          )}
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="text-lg text-muted-foreground mb-4">{post.excerpt}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span>{post.author.name || 'Anonymous'}</span>
            </div>
            {post.publishedAt && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <time dateTime={post.publishedAt.toISOString()}>
                  {new Date(post.publishedAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              </div>
            )}
          </div>
        </header>

        {/* Featured Image */}
        {post.featuredImage && (
          <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden mb-8">
            <Image
              src={post.featuredImage}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-serif prose-a:text-salsa-600 hover:prose-a:text-salsa-700">
          {paragraphs.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>

        {/* Author card */}
        <Card className="mt-12 p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-salsa-100 flex items-center justify-center dark:bg-salsa-900">
              <User className="h-6 w-6 text-salsa-600" />
            </div>
            <div>
              <p className="font-medium">{post.author.name || 'Anonymous'}</p>
              <p className="text-sm text-muted-foreground">Community Blogger</p>
            </div>
          </div>
        </Card>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <div className="max-w-5xl mx-auto mt-16">
          <h2 className="text-2xl font-serif font-bold mb-6">Related Posts</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {relatedPosts.map((related) => (
              <Link key={related.slug} href={`/blog/${related.slug}`}>
                <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow group">
                  {related.featuredImage ? (
                    <div className="relative h-40 bg-slate-100">
                      <Image
                        src={related.featuredImage}
                        alt={related.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </div>
                  ) : (
                    <div className="h-40 bg-gradient-to-br from-salsa-50 to-chile-50 dark:from-salsa-950 dark:to-chile-950 flex items-center justify-center">
                      <Newspaper className="h-8 w-8 text-salsa-300" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-medium group-hover:text-salsa-600 transition-colors line-clamp-2">
                      {related.title}
                    </h3>
                    {related.excerpt && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {related.excerpt}
                      </p>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="max-w-3xl mx-auto mt-12 text-center">
        <p className="text-muted-foreground mb-3">
          Want to share your own stories with the Zanesville community?
        </p>
        <Link href="/auth/signup">
          <Button variant="outline">Join the Blog</Button>
        </Link>
      </div>
    </div>
  )
}
