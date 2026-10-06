import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { formatFundraisingBlogDate, getFundraisingBlogPosts } from '@/lib/fundraising-site/blog-posts'
import { PageHero } from '../_components/page-hero'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'News and notes from the Jose Madrid Salsa fundraising team in Zanesville, Ohio.',
  alternates: { canonical: '/blog' },
}

export default function FundraisingBlogPage() {
  const posts = getFundraisingBlogPosts()
  return (
    <>
      <PageHero eyebrow="Blog" title="News from the salsa kitchen" />
      <section className="py-14">
        <div className="container mx-auto max-w-3xl space-y-6 px-4">
          {posts.map((post) => (
            <article key={post.slug} className="card surface-shadow p-6">
              <p className="text-sm text-muted-foreground">
                <time dateTime={post.date}>{formatFundraisingBlogDate(post.date)}</time> · {post.author}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-foreground">
                <Link href={`/blog/${post.slug}`} className="hover:text-salsa-600">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-muted-foreground">{post.summary}</p>
              <Link href={`/blog/${post.slug}`} className="mt-4 inline-flex items-center gap-1 font-semibold text-salsa-600 hover:underline">
                Read more <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
