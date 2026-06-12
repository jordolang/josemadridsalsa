import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ExternalLink, PenSquare, Plus } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Developer Blog - Developer Console',
  description: 'Manage developer blog posts.',
  pathname: '/admin/developer/blog',
})

export default async function DeveloperBlogAdminPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'developer:blog'))) {
    redirect('/admin')
  }

  const posts = await prisma.developerBlogPost.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      tags: true,
      published: true,
      publishedAt: true,
      updatedAt: true,
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Developer Blog</CardTitle>
            <CardDescription>
              Posts published here appear on the public developer blog.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/developer/blog" target="_blank">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                View Blog
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/admin/developer/blog/new">
                <Plus className="mr-1.5 h-4 w-4" />
                New Post
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-44">Updated</TableHead>
              <TableHead className="w-20 text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => (
              <TableRow key={post.id}>
                <TableCell>
                  <div className="font-medium">{post.title}</div>
                  <div className="font-mono text-xs text-muted-foreground">/{post.slug}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {post.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={post.published ? 'default' : 'secondary'}>
                    {post.published ? 'Published' : 'Draft'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {post.updatedAt.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/developer/blog/${post.id}`}>
                      <PenSquare className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {posts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No posts yet. Create the first one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
