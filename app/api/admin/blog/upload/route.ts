import { NextRequest } from 'next/server'
import { put } from '@vercel/blob'
import { ok, fail, serverError } from '@/lib/api'
import { requirePermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
} as const

const MAX_BYTES = 25 * 1024 * 1024

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * POST /api/admin/blog/upload
 * Accepts multipart form data: `file` (binary), optional `alt`, `caption`.
 * Stores to Vercel Blob, records a Media row, returns the public URL.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('content:write')

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return fail(
        'Uploads disabled: BLOB_READ_WRITE_TOKEN is not configured on the server',
        503
      )
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return fail('Missing file', 400)

    const mime = file.type as keyof typeof ALLOWED
    const ext = ALLOWED[mime]
    if (!ext) return fail(`Unsupported file type: ${file.type}`, 415)
    if (file.size > MAX_BYTES) return fail('File exceeds 25 MB limit', 413)

    const alt = (form.get('alt') as string | null) ?? null
    const caption = (form.get('caption') as string | null) ?? null

    const base = slugifyName(file.name) || 'upload'
    const key = `heat-index/${Date.now()}-${base}.${ext}`

    const blob = await put(key, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
    })

    const media = await prisma.media.create({
      data: {
        url: blob.url,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        alt,
        caption,
      },
    })

    return ok(
      {
        media,
        url: blob.url,
        isVideo: file.type.startsWith('video/'),
        uploadedBy: user.id,
      },
      201
    )
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unauthorized'))
      return fail('Unauthorized', 401)
    if (error instanceof Error && error.message.includes('Forbidden'))
      return fail('Forbidden', 403)
    return serverError('Upload failed', error)
  }
}
