import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { CROSSPOST_PLATFORMS } from '@/lib/social/blog-crosspost'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/heat-index/social-accounts
 * Admin — connected social accounts a blog article can be cross-posted to.
 * Gated on content:write so the blog editor can list channels without needing
 * the broader social_media permissions.
 */
export async function GET() {
  try {
    await requirePermission('content:write')

    const accounts = await prisma.socialAccount.findMany({
      where: { isActive: true, platform: { in: CROSSPOST_PLATFORMS } },
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountHandle: true,
        profileImageUrl: true,
      },
      orderBy: [{ platform: 'asc' }, { accountName: 'asc' }],
    })

    return ok({ accounts })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Failed to load social accounts', error)
  }
}
