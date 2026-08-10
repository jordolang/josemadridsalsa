import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publishPost } from '@/lib/social/publisher'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'

// Publishes scheduled social posts whose time has arrived. Triggered every 5 minutes by
// Vercel Cron. Without this, "Schedule" only ever saved a row and never actually posted —
// the gap that made scheduling look done but do nothing.
//
// This ran from a GitHub Actions workflow while the project was on the Vercel Hobby plan,
// which capped crons at daily. Pro lifts that, and the workflow was removed rather than left
// alongside: `publishPost` guards against re-publishing an already-PUBLISHED pair, but the
// check and the claim are not atomic, so two schedulers racing the same queue could both
// pass the guard and post twice. One scheduler is the guarantee.

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
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
