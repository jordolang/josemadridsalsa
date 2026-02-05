import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BlogPostEditor } from '@/components/account/BlogPostEditor'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Edit Post - Taste of Zanesville Blog',
  description: 'Edit your blog post on the Taste of Zanesville community blog.',
  pathname: '/account/blog/edit',
})

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/account/blog')
  }

  const userId = (session.user as any).id
  const { id } = await params

  const access = await prisma.blogAccessRequest.findUnique({
    where: { userId },
  })

  if (!access || access.status !== 'APPROVED') {
    redirect('/account')
  }

  const post = await prisma.blogPost.findFirst({
    where: { id, authorId: userId },
  })

  if (!post) {
    redirect('/account/blog')
  }

  return (
    <BlogPostEditor
      post={{
        id: post.id,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        featuredImage: post.featuredImage,
        category: post.category,
        status: post.status,
      }}
    />
  )
}
