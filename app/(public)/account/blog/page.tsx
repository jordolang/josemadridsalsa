import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PenLine, Plus, Newspaper } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'My Blog Posts - Taste of Zanesville',
  description: 'Manage your blog posts on the Taste of Zanesville community blog.',
  pathname: '/account/blog',
})

export default async function AccountBlogPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/account/blog')
  }

  const userId = (session.user as any).id

  // Verify blog access
  const access = await prisma.blogAccessRequest.findUnique({
    where: { userId },
  })

  if (!access || access.status !== 'APPROVED') {
    redirect('/account')
  }

  const posts = await prisma.blogPost.findMany({
    where: { authorId: userId },
    orderBy: { updatedAt: 'desc' },
  })

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    PENDING_REVIEW: 'bg-yellow-100 text-yellow-700',
    PUBLISHED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Blog Posts</h1>
          <p className="text-sm text-muted-foreground">Create and manage your community blog posts</p>
        </div>
        <Link href="/account/blog/new">
          <Button className="bg-salsa-500 hover:bg-salsa-600">
            <Plus className="mr-2 h-4 w-4" />
            New Post
          </Button>
        </Link>
      </div>

      {posts.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <Newspaper className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No blog posts yet</p>
            <p className="mt-1 text-sm">Create your first post to share with the Zanesville community!</p>
            <Link href="/account/blog/new">
              <Button className="mt-4 bg-salsa-500 hover:bg-salsa-600">
                <PenLine className="mr-2 h-4 w-4" />
                Write Your First Post
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <Card key={post.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{post.title}</h3>
                    <Badge className={statusColors[post.status] || ''}>
                      {post.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {post.excerpt && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {post.category && <span>Category: {post.category}</span>}
                    <span>Updated: {new Date(post.updatedAt).toLocaleDateString()}</span>
                    {post.publishedAt && (
                      <span>Published: {new Date(post.publishedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Link href={`/account/blog/${post.id}/edit`}>
                    <Button variant="outline" size="sm">
                      <PenLine className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                  </Link>
                  {post.status === 'PUBLISHED' && (
                    <Link href={`/blog/${post.slug}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
