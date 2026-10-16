import sharp from 'sharp'
import { z } from 'zod'
import { SITE_URL } from '@/lib/feeds/products'

/**
 * GET /api/feeds/image?src=<absolute image URL>
 *
 * Re-encodes a product image as an opaque JPEG for catalog feeds. Meta
 * Commerce only accepts JPEG/PNG, while product images are stored as
 * transparent WebP — so the Facebook feed points its image links here.
 *
 * Only our own site and Vercel Blob storage are allowed as sources, so this
 * cannot be used as an open proxy.
 */

export const runtime = 'nodejs'

const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com'
const SITE_HOST = new URL(SITE_URL).host

const srcSchema = z
  .string()
  .refine((value) => {
    if (!URL.canParse(value)) return false
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      (url.host === SITE_HOST || url.host.endsWith(BLOB_HOST_SUFFIX))
    )
  }, 'Image source host is not allowed')

export async function GET(request: Request) {
  const parsed = srcSchema.safeParse(new URL(request.url).searchParams.get('src'))
  if (!parsed.success) {
    return Response.json({ error: 'Invalid image source' }, { status: 400 })
  }

  const upstream = await fetch(parsed.data)
  if (!upstream.ok) {
    return Response.json({ error: 'Image not found' }, { status: 404 })
  }

  let jpeg: Buffer
  try {
    jpeg = await sharp(Buffer.from(await upstream.arrayBuffer()))
      // Transparent pixels would otherwise turn black in JPEG.
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toBuffer()
  } catch {
    return Response.json({ error: 'Unsupported image' }, { status: 422 })
  }

  return new Response(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': 'image/jpeg',
      // Source images are immutable blob URLs; let the CDN hold the result.
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  })
}
