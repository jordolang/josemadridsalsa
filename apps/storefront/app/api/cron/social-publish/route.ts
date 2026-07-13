import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publishPost } from '@/lib/social/publisher'

// Publishes scheduled social posts whose time has arrived. Triggered every 15
// minutes by the GitHub Actions workflow .github/workflows/social-publish.yml
// (Vercel's free plan caps cron jobs, so we drive it from Actions instead).
// Without this, "Schedule" only ever saved a row and never actually posted —
// the gap that made scheduling look done but do nothing.

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

  const due = await prisma.socialMediaPost.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
    },
    select: { id: true },
    take: 25,
    orderBy: { scheduledAt: 'asc' },
  })

  let published = 0
  let failed = 0
  const errors: Array<{ postId: string; error: string }> = []

  for (const post of due) {
    try {
      await publishPost(post.id)
      published++
    } catch (error) {
      failed++
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push({ postId: post.id, error: message })
      // Mark the post failed so it isn't retried forever and is visible in the UI.
      await prisma.socialMediaPost
        .update({ where: { id: post.id }, data: { status: 'FAILED' } })
        .catch(() => {})
    }
  }

  return NextResponse.json({ processed: due.length, published, failed, errors })
}
