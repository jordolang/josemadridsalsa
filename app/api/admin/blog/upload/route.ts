import { NextRequest } from 'next/server'
import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import {
  BlobUploadError,
  VERCEL_SERVER_UPLOAD_MAX_BYTES,
  uploadToVercelBlob,
} from '@/lib/blob-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/blog/upload
 * Accepts multipart form data: `file` (binary), optional `alt`, `caption`.
 * Stores to Vercel Blob, records a Media row, returns the public URL.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('content:write')

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return fail('Missing file', 400)

    const alt = (form.get('alt') as string | null) ?? null
    const caption = (form.get('caption') as string | null) ?? null

    const upload = await uploadToVercelBlob(file, {
      directory: 'heat-index',
      maxBytes: VERCEL_SERVER_UPLOAD_MAX_BYTES,
    })

    const media = await prisma.media.create({
      data: {
        url: upload.url,
        filename: upload.filename,
        mimeType: upload.mimeType,
        fileSize: upload.fileSize,
        alt,
        caption,
      },
    })

    return ok(
      {
        media,
        url: upload.url,
        isVideo: upload.isVideo,
        uploadedBy: user.id,
      },
      201
    )
  } catch (error: unknown) {
    if (error instanceof BlobUploadError) return fail(error.message, error.status)
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Upload failed', error)
  }
}
