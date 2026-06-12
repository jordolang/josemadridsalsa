import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import prisma from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { DeveloperBlogPostForm } from '@/components/admin/developer/DeveloperBlogPostForm'
import { createMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Edit Post - Developer Console',
  description: 'Edit a developer blog post.',
  pathname: '/admin/developer/blog',
})

export default async function EditDeveloperBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'developer:blog'))) {
    redirect('/admin')
  }

  const { id } = await params
  const post = await prisma.developerBlogPost.findUnique({ where: { id } })

  if (!post) {
    notFound()
  }

  return (
    <DeveloperBlogPostForm
      post={{
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        coverImage: post.coverImage,
        tags: post.tags,
        published: post.published,
      }}
    />
  )
}
