import { ok, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { developerApiErrorResponse } from '@/lib/developer/api-errors'
import { listRepoMarkdownFiles } from '@/lib/developer/repo-docs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/developer/admin/salsadocs/repo-files
 * Developer-only — list Markdown files in this repository that can be
 * imported into Salsadocs.
 */
export async function GET() {
  try {
    await requirePermission('developer:salsadocs')
    const files = await listRepoMarkdownFiles()
    return ok({ files })
  } catch (error: unknown) {
    return developerApiErrorResponse(error) ?? serverError('Failed to list repository markdown files', error)
  }
}
