import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { BlobUploadError } from '@/lib/blob-storage'
import { deleteBlobFiles, listBlobDirectory } from '@/lib/developer/blob-explorer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const deleteBlobSchema = z.object({
  urls: z.array(z.string().min(1)).min(1).max(100),
})

function toErrorResponse(error: unknown) {
  if (error instanceof BlobUploadError) {
    return fail(error.message, error.status)
  }
  if (error instanceof Error && error.message.includes('Unauthorized')) {
    return fail('Unauthorized', 401)
  }
  if (error instanceof Error && error.message.includes('Forbidden')) {
    return fail('Forbidden', 403)
  }
  return null
}

/**
 * GET /api/developer/admin/blob?prefix=dir/&cursor=...
 * Developer-only — list one directory level of the josemadridsalsa-blob store.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission('developer:blob')

    const { searchParams } = new URL(req.url)
    const listing = await listBlobDirectory({
      prefix: searchParams.get('prefix') ?? '',
      cursor: searchParams.get('cursor') ?? undefined,
    })

    return ok(listing)
  } catch (error: unknown) {
    return toErrorResponse(error) ?? serverError('Failed to list blob storage', error)
  }
}

/**
 * DELETE /api/developer/admin/blob
 * Developer-only — delete files from the josemadridsalsa-blob store.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission('developer:blob')

    const body = await req.json()
    const parsed = deleteBlobSchema.safeParse(body)
    if (!parsed.success) {
      return fail(`Validation error: ${parsed.error.issues[0].message}`)
    }

    await deleteBlobFiles(parsed.data.urls)

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'developer.blob.delete',
        entityType: 'blob',
        changes: { urls: parsed.data.urls },
      },
      req,
    )

    return ok({ deleted: parsed.data.urls.length })
  } catch (error: unknown) {
    return toErrorResponse(error) ?? serverError('Failed to delete blob files', error)
  }
}
