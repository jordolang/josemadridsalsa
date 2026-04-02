'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeveloperBlogCard } from './developer-blog-card'

interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt: string
  coverImage: string | null
  tags: string[]
  publishedAt: string | null
}

export function DeveloperBlogPreview() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/developer/blog?limit=3')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => setPosts(body.data ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">
          Blog posts coming soon
        </p>
        <p className="text-muted-foreground/60 text-sm mt-1">
          Stories from the development journey
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <DeveloperBlogCard
            key={post.id}
            slug={post.slug}
            title={post.title}
            excerpt={post.excerpt}
            coverImage={post.coverImage}
            tags={post.tags}
            publishedAt={post.publishedAt}
          />
        ))}
      </div>

      <div className="flex justify-center">
        <Link href="/developer/blog">
          <Button variant="outline" className="gap-2">
            View All Posts
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
