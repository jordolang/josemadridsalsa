import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Newspaper, Users, FileText, Clock, CheckCircle, XCircle } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Blog Management - Jose Madrid Salsa Admin',
  description: 'Manage the Taste of Zanesville community blog.',
  pathname: '/admin/blog',
})

export default async function AdminBlogPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:read'))) {
    redirect('/admin')
  }

  const [
    pendingRequests,
    approvedBloggers,
    pendingPosts,
    publishedPosts,
    totalPosts,
  ] = await Promise.all([
    prisma.blogAccessRequest.count({ where: { status: 'PENDING' } }),
    prisma.blogAccessRequest.count({ where: { status: 'APPROVED' } }),
    prisma.blogPost.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.blogPost.count({ where: { status: 'PUBLISHED' } }),
    prisma.blogPost.count(),
  ])

  const recentPosts = await prisma.blogPost.findMany({
    take: 5,
    orderBy: { updatedAt: 'desc' },
    include: {
      author: {
        select: { name: true, email: true },
      },
    },
  })

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    PENDING_REVIEW: 'bg-yellow-100 text-yellow-700',
    PUBLISHED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Taste of Zanesville Blog</h1>
        <p className="text-slate-600">Manage community blog access requests and posts</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-sm text-slate-600">Pending Requests</p>
              <p className="text-2xl font-bold">{pendingRequests}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-slate-600">Approved Bloggers</p>
              <p className="text-2xl font-bold">{approvedBloggers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-sm text-slate-600">Pending Review</p>
              <p className="text-2xl font-bold">{pendingPosts}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Newspaper className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-slate-600">Published Posts</p>
              <p className="text-2xl font-bold">{publishedPosts}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/admin/blog/requests">
          <Button variant="outline">
            <Users className="mr-2 h-4 w-4" />
            Manage Access Requests
            {pendingRequests > 0 && (
              <Badge className="ml-2 bg-yellow-100 text-yellow-700">{pendingRequests}</Badge>
            )}
          </Button>
        </Link>
        <Link href="/admin/blog/posts">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Manage Posts
            {pendingPosts > 0 && (
              <Badge className="ml-2 bg-orange-100 text-orange-700">{pendingPosts}</Badge>
            )}
          </Button>
        </Link>
      </div>

      {/* Recent Posts */}
      <Card className="p-0">
        <div className="p-4 border-b">
          <h2 className="text-lg font-medium">Recent Blog Posts</h2>
        </div>
        {recentPosts.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Newspaper className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p>No blog posts yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {recentPosts.map((post) => (
              <div key={post.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{post.title}</p>
                  <p className="text-xs text-slate-500">
                    by {post.author.name || post.author.email} &middot;{' '}
                    {new Date(post.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge className={statusColors[post.status] || 'bg-slate-100 text-slate-700'}>
                  {post.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
