import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publishBlogPost } from '@/lib/blog/publish'

// Publishes scheduled Heat Index blog posts whose time has arrived. Triggered
// every 15 minutes by the GitHub Actions workflow .github/workflows/blog-publish.yml
// (Vercel's free plan caps cron jobs, so we drive it from Actions instead).
// Without this, the editor's "Scheduled" status only ever saved a row and never
// flipped it to PUBLISHED — so the post never appeared on the public site and
// returned a 404, the same gap that was already fixed for social posts.

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // No secret configured → allow (matches other crons).
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const due = await prisma.blogPost.findMany({
    where: {
      status: 'SCHEDULED',
      // A scheduled post is due once its time has passed. Treat a missing
      // scheduledFor as due too, so a post marked "Scheduled" without a date
      // still goes live instead of being stuck invisible forever.
      OR: [{ scheduledFor: { lte: now } }, { scheduledFor: null }],
    },
    select: { id: true },
    take: 25,
    orderBy: { scheduledFor: 'asc' },
  })

  let published = 0
  let failed = 0
  const errors: Array<{ postId: string; error: string }> = []

  for (const post of due) {
    try {
      await prisma.blogPost.update({
        where: { id: post.id },
        data: { status: 'PUBLISHED', publishedAt: now },
      })
      // Send subscriber notifications; a failure here must not un-publish the
      // post, so log it and move on (matches the create/update publish path).
      await publishBlogPost(post.id).catch((err) => {
        console.error('Failed to send publish notifications:', err)
      })
      published++
    } catch (error) {
      failed++
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push({ postId: post.id, error: message })
    }
  }

  return NextResponse.json({ processed: due.length, published, failed, errors })
}
