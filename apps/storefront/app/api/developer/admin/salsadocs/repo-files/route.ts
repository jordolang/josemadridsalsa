import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
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
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return fail('Unauthorized', 401)
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return fail('Forbidden', 403)
    }
    return serverError('Failed to list repository markdown files', error)
  }
}
