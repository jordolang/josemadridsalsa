import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { GET } from '@/app/api/feeds/image/route'

const BLOB_URL = 'https://abc.public.blob.vercel-storage.com/products/salsa.webp'

function request(src?: string) {
  const url = new URL('https://www.josemadridsalsa.com/api/feeds/image')
  if (src) url.searchParams.set('src', src)
  return new Request(url)
}

describe('GET /api/feeds/image', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('re-encodes a transparent WebP as an opaque JPEG on white', async () => {
    const webp = await sharp({
      create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .webp()
      .toBuffer()
    vi.mocked(global.fetch).mockResolvedValue(new Response(new Uint8Array(webp)))

    const res = await GET(request(BLOB_URL))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(global.fetch).toHaveBeenCalledWith(BLOB_URL)
    const out = Buffer.from(await res.arrayBuffer())
    const meta = await sharp(out).metadata()
    expect(meta.format).toBe('jpeg')
    const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true })
    expect(data[0]).toBeGreaterThan(250)
  })

  it.each([
    [undefined],
    ['not a url'],
    ['http://abc.public.blob.vercel-storage.com/a.webp'],
    ['https://evil.example.com/a.webp'],
    ['https://public.blob.vercel-storage.com.evil.com/a.webp'],
  ])('rejects disallowed source %s without fetching', async (src) => {
    const res = await GET(request(src))
    expect(res.status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns 404 when the source image is missing', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('nope', { status: 404 }))
    const res = await GET(request(BLOB_URL))
    expect(res.status).toBe(404)
  })

  it('returns 422 when the source is not an image', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('<html></html>'))
    const res = await GET(request(BLOB_URL))
    expect(res.status).toBe(422)
  })
})
