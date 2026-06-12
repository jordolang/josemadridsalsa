import { ok, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { developerApiErrorResponse } from '@/lib/developer/api-errors'
import { listSalsadocsTree, salsadocsConfigured } from '@/lib/developer/salsadocs'

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
    return developerApiErrorResponse(error) ?? serverError('Failed to load the salsadocs tree', error)
  }
}
