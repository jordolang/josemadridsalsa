import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

vi.mock('@/lib/feeds/products', () => ({ getFeedProductImages: vi.fn() }))

const { getFeedProductImages } = await import('@/lib/feeds/products')
const { GET } = await import('@/app/feed-images/[sku]/[file]/route')

const PRIMARY = 'https://abc.public.blob.vercel-storage.com/products/salsa.webp'
const EXTRA = 'https://cdn.example.com/salsa-2.webp'

function get(sku: string, file: string) {
  return GET(new Request(`https://www.josemadridsalsa.com/feed-images/${sku}/${file}`), {
    params: Promise.resolve({ sku, file }),
  })
}

async function transparentWebp() {
  return sharp({
    create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .webp()
    .toBuffer()
}

describe('GET /feed-images/[sku]/[file]', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    vi.mocked(getFeedProductImages).mockResolvedValue([PRIMARY, EXTRA])
  })

  it('re-encodes the product image as an opaque JPEG on white', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(new Uint8Array(await transparentWebp())))

    const res = await get('JMS-1', '0.jpg')

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(getFeedProductImages).toHaveBeenCalledWith('JMS-1')
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe(PRIMARY)
    const out = Buffer.from(await res.arrayBuffer())
    expect((await sharp(out).metadata()).format).toBe('jpeg')
    const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true })
    expect(data[0]).toBeGreaterThan(250)
  })

  it('serves additional images from any host on the product record', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(new Uint8Array(await transparentWebp())))
    const res = await get('JMS-1', '1.jpg')
    expect(res.status).toBe(200)
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe(EXTRA)
  })

  it.each([
    ['unknown product', 'NOPE', '0.jpg', null],
    ['out-of-range index', 'JMS-1', '2.jpg', [PRIMARY, EXTRA]],
    ['malformed file name', 'JMS-1', 'x.png', [PRIMARY, EXTRA]],
  ])('returns 404 for %s without fetching', async (_label, sku, file, images) => {
    vi.mocked(getFeedProductImages).mockResolvedValue(images)
    const res = await get(sku, file)
    expect(res.status).toBe(404)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns 502 when the source is missing, oversized, or not an image', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response('nope', { status: 404 }))
    expect((await get('JMS-1', '0.jpg')).status).toBe(502)

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('x', { headers: { 'content-length': String(50 * 1024 * 1024) } }),
    )
    expect((await get('JMS-1', '0.jpg')).status).toBe(502)

    vi.mocked(global.fetch).mockResolvedValueOnce(new Response('<html></html>'))
    expect((await get('JMS-1', '0.jpg')).status).toBe(502)

    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('timeout'))
    expect((await get('JMS-1', '0.jpg')).status).toBe(502)
  })
})
