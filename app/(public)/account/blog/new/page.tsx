import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BlogPostEditor } from '@/components/account/BlogPostEditor'
import { createMetadata } from '@/lib/metadata'

export const metadata: Metadata = createMetadata({
  title: 'Create New Post - Taste of Zanesville Blog',
  description: 'Create a new blog post for the Taste of Zanesville community.',
  pathname: '/account/blog/new',
})

export default async function NewBlogPostPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/account/blog/new')
  }

  const userId = (session.user as any).id

  const access = await prisma.blogAccessRequest.findUnique({
    where: { userId },
  })

  if (!access || access.status !== 'APPROVED') {
    redirect('/account')
  }

  return <BlogPostEditor />
}
