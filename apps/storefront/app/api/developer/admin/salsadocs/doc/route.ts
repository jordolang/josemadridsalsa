import { NextRequest } from 'next/server'
import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { developerApiErrorResponse } from '@/lib/developer/api-errors'
import { getSalsadocsFile } from '@/lib/developer/salsadocs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/developer/admin/salsadocs/doc?path=content/docs/...
 * Developer-only — fetch one document from the salsadocs repository for editing.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission('developer:salsadocs')

    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')
    if (!path) {
      return fail('Missing "path" query parameter')
    }

    const file = await getSalsadocsFile(path)
    return ok(file)
  } catch (error: unknown) {
    return developerApiErrorResponse(error) ?? serverError('Failed to fetch the document', error)
  }
}
