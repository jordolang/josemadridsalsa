import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { listSalsadocsTree, salsadocsConfigured, SalsadocsError } from '@/lib/developer/salsadocs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/developer/admin/salsadocs/tree
 * Developer-only — documentation tree of the salsadocs repository.
 */
export async function GET() {
  try {
    await requirePermission('developer:salsadocs')

    if (!salsadocsConfigured()) {
      return ok({ configured: false, tree: null })
    }

    const tree = await listSalsadocsTree()
    return ok({ configured: true, tree })
  } catch (error: unknown) {
    if (error instanceof SalsadocsError) {
      return fail(error.message, error.status)
    }
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return fail('Forbidden', 403)
    }
    return serverError('Failed to load the salsadocs tree', error)
  }
}
