import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { fail } from '@/lib/api'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { blobUploadsConfigured } from '@/lib/blob-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024 // 500 MB per file via client uploads

/**
 * POST /api/developer/admin/blob/upload
 * Developer-only — token exchange for client uploads to the
 * josemadridsalsa-blob store. Client uploads bypass the 4.5 MB serverless
 * body limit, so the file explorer can take arbitrary files.
 */
export async function POST(req: NextRequest) {
  if (!blobUploadsConfigured()) {
    return fail('Uploads disabled: BLOB_READ_WRITE_TOKEN is not configured', 503)
  }

  const user = await getCurrentUser()
  if (!user) {
    return fail('Unauthorized', 401)
  }
  if (!(await hasPermission(user, 'developer:blob'))) {
    return fail('Forbidden - requires permission: developer:blob', 403)
  }

  let body: HandleUploadBody
  try {
    body = (await req.json()) as HandleUploadBody
  } catch {
    return fail('Invalid request body')
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (pathname.startsWith('/') || pathname.split('/').some((s) => s === '..' || s === '')) {
          throw new Error('Invalid upload path')
        }

        return {
          addRandomSuffix: false,
          allowOverwrite: true,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          tokenPayload: JSON.stringify({ userId: user.id }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Not invoked on localhost (requires a publicly reachable callback URL)
        const payload = tokenPayload ? (JSON.parse(tokenPayload) as { userId?: string }) : {}
        await logAudit({
          userId: payload.userId ?? null,
          action: 'developer.blob.upload',
          entityType: 'blob',
          entityId: blob.pathname,
          changes: { url: blob.url },
        })
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Upload failed')
  }
}
