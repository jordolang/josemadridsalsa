import sharp from 'sharp'
import { z } from 'zod'
import { decodeFeedSku } from '@/lib/feeds/facebook'
import { getFeedProductImages } from '@/lib/feeds/products'

/**
 * GET /feed-images/<base64url sku>/<n>.jpg
 *
 * Serves image n of an active product (0 = primary, 1… = additional) as an
 * opaque JPEG for catalog feeds. Meta Commerce only accepts JPEG/PNG, while
 * product images are stored as transparent WebP.
 *
 * The source URL always comes from the product record, never the request, so
 * this cannot be pointed at arbitrary hosts. It sits outside /api/ because
 * robots.txt disallows that tree and Meta's image fetcher honors it.
 */

export const runtime = 'nodejs'

const FETCH_TIMEOUT_MS = 10_000
const MAX_SOURCE_BYTES = 20 * 1024 * 1024

const paramsSchema = z.object({
  sku: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
  file: z.string().regex(/^\d{1,2}\.jpg$/),
})

function error(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sku: string; file: string }> },
) {
  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) return error('Not found', 404)

  const images = await getFeedProductImages(decodeFeedSku(parsed.data.sku))
  const source = images?.[Number.parseInt(parsed.data.file, 10)]
  if (!source) return error('Not found', 404)

  let upstream: Response
  try {
    upstream = await fetch(source, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch {
    return error('Image source unavailable', 502)
  }
  if (!upstream.ok) return error('Image source unavailable', 502)
  if (Number(upstream.headers.get('content-length') ?? 0) > MAX_SOURCE_BYTES) {
    return error('Image too large', 502)
  }

  let jpeg: Buffer
  try {
    const input = Buffer.from(await upstream.arrayBuffer())
    if (input.byteLength > MAX_SOURCE_BYTES) return error('Image too large', 502)
    jpeg = await sharp(input)
      // Transparent pixels would otherwise turn black in JPEG.
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toBuffer()
  } catch {
    return error('Unsupported image', 502)
  }

  return new Response(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': 'image/jpeg',
      // Feed URLs carry a version of the source URL, so the CDN can hold them.
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  })
}
