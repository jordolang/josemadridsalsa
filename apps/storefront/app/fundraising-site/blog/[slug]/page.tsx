import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import {
  FUNDRAISING_BLOG_POSTS,
  formatFundraisingBlogDate,
  getFundraisingBlogPost,
} from '@/lib/fundraising-site/blog-posts'

type Params = Promise<{ slug: string }>

export const dynamicParams = false

export function generateStaticParams() {
  return FUNDRAISING_BLOG_POSTS.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const post = getFundraisingBlogPost(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: 'article', title: post.title, description: post.summary, publishedTime: post.date },
  }
}

export default async function FundraisingBlogPostPage({ params }: { params: Params }) {
  const { slug } = await params
  const post = getFundraisingBlogPost(slug)
  if (!post) notFound()

  return (
    <article className="py-14">
      <div className="container mx-auto max-w-3xl px-4">
        <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-semibold text-salsa-600 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All posts
        </Link>
        <header className="mt-6 border-b border-border pb-6">
          <h1 className="font-serif text-4xl font-bold text-foreground">{post.title}</h1>
          <p className="mt-3 text-muted-foreground">
            <time dateTime={post.date}>{formatFundraisingBlogDate(post.date)}</time> · {post.author}
          </p>
        </header>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-foreground/90">
          {post.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {post.link ? (
          <a
            href={post.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-salsa-600 to-chile-600 px-5 py-3 font-semibold text-white hover:from-salsa-700 hover:to-chile-700"
          >
            {post.link.label} <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        ) : null}
      </div>
    </article>
  )
}
