import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { publishPost } from '@/lib/social/publisher'
import { logAudit } from '@/lib/audit'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'social_media:publish'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { postId } = body

  if (!postId || typeof postId !== 'string') {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 })
  }

  try {
    const { results } = await publishPost(postId)

    await logAudit({
      userId: user.id,
      action: 'social_post.publish',
      entityType: 'SocialMediaPost',
      entityId: postId,
      changes: {
        results: results.map((r) => ({
          platform: r.platform,
          success: r.result.success,
          error: r.result.error ?? null,
        })),
      },
    })

    const succeeded = results.filter((r) => r.result.success).length
    const failed = results.filter((r) => !r.result.success).length

    return NextResponse.json({
      success: succeeded > 0,
      message: `Published to ${succeeded} account${succeeded !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publish failed' },
      { status: 500 },
    )
  }
}
