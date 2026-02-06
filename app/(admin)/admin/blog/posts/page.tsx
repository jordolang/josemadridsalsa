import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Newspaper } from 'lucide-react'
import { createMetadata } from '@/lib/metadata'
import { BlogPostAdminActions } from '@/components/admin/BlogPostAdminActions'

export const metadata: Metadata = createMetadata({
  title: 'Blog Posts - Jose Madrid Salsa Admin',
  description: 'Manage community blog posts.',
  pathname: '/admin/blog/posts',
})

export default async function AdminBlogPostsPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:read'))) {
    redirect('/admin')
  }

  const canWrite = await hasPermission(user, 'content:write')

  const posts = await prisma.blogPost.findMany({
    orderBy: [
      { status: 'asc' },
      { updatedAt: 'desc' },
    ],
    include: {
      author: {
        select: {
          id: true,
          email: true,
          name: true,
        },
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
        <h1 className="text-3xl font-bold">Blog Posts</h1>
        <p className="text-slate-600">Review, publish, and moderate community blog posts</p>
      </div>

      {posts.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-slate-500">
            <Newspaper className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium">No blog posts yet</p>
            <p className="mt-1 text-sm">Posts will appear here when community bloggers create content</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Author</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Updated</th>
                  {canWrite && (
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{post.title}</p>
                      <p className="text-xs text-slate-500">/{post.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {post.author.name || post.author.email}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {post.category || <span className="text-slate-400">Uncategorized</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusColors[post.status] || 'bg-slate-100 text-slate-700'}>
                        {post.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(post.updatedAt).toLocaleDateString()}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-3">
                        <BlogPostAdminActions
                          postId={post.id}
                          currentStatus={post.status}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
