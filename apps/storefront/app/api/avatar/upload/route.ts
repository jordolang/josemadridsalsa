import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { fail, serverError } from '@/lib/api'
import { getCurrentUser } from '@/lib/rbac'
import { detectAvatarType, MAX_AVATAR_BYTES } from '@/lib/avatar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/avatar/upload — the signed-in user's profile picture.
 *
 * The body is the raw image. Its type is read from the file's own bytes, never from a
 * name or header the caller chose, and the stored path is built here from the user id,
 * so a request can neither pick where it lands nor upload something that isn't an image.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return fail('Sign in to upload an avatar', 401)

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return fail('Uploads disabled: BLOB_READ_WRITE_TOKEN is not configured', 503)

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_AVATAR_BYTES) return fail('Images must be 4 MB or smaller', 413)

  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length === 0) return fail('Empty request body', 400)
  if (bytes.length > MAX_AVATAR_BYTES) return fail('Images must be 4 MB or smaller', 413)

  const type = detectAvatarType(bytes)
  if (!type) return fail('Upload a JPEG, PNG or WebP image', 415)

  try {
    const blob = await put(`avatars/${user.id}.${type.extension}`, Buffer.from(bytes), {
      access: 'public',
      contentType: type.contentType,
      addRandomSuffix: true,
      token,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    return serverError('Upload failed', error)
  }
}
