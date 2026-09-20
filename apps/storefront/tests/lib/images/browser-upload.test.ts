import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  UPLOAD_BUDGET_BYTES,
  formatMb,
  jpegFileName,
  planUpload,
  readUploadResponse,
  recompressImage,
  scaledDimensions,
  uploadFailureMessage,
} from '@/lib/images/browser-upload'

const MB = 1024 * 1024

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('planUpload', () => {
  it('sends a supported file that is already under budget', () => {
    expect(planUpload({ type: 'image/jpeg', size: 2 * MB })).toEqual({ action: 'send' })
  })

  it('recompresses a raster image over budget instead of refusing it', () => {
    // The regression: a phone photo over Vercel's 4.5 MB body cap used to be sent anyway, get
    // refused at the edge with an HTML error page, and surface as a browser parse error.
    expect(planUpload({ type: 'image/jpeg', size: 8 * MB })).toEqual({ action: 'recompress' })
    expect(planUpload({ type: 'image/png', size: 6 * MB })).toEqual({ action: 'recompress' })
    expect(planUpload({ type: 'image/webp', size: 5 * MB })).toEqual({ action: 'recompress' })
  })

  it('refuses an over-budget file a canvas cannot redraw, naming both sizes', () => {
    const gif = planUpload({ type: 'image/gif', size: 9 * MB })
    expect(gif.action).toBe('reject')
    expect(gif.action === 'reject' && gif.reason).toContain('9.0 MB')
    expect(gif.action === 'reject' && gif.reason).toContain('4.0 MB')

    expect(planUpload({ type: 'video/mp4', size: 20 * MB }).action).toBe('reject')
    expect(planUpload({ type: 'image/svg+xml', size: 5 * MB }).action).toBe('reject')
  })

  it('sends an under-budget GIF, SVG or video untouched', () => {
    expect(planUpload({ type: 'image/gif', size: MB })).toEqual({ action: 'send' })
    expect(planUpload({ type: 'image/svg+xml', size: 1024 })).toEqual({ action: 'send' })
    expect(planUpload({ type: 'video/quicktime', size: 3 * MB })).toEqual({ action: 'send' })
  })

  it('tells an iPhone author how to get out of HEIC', () => {
    const plan = planUpload({ type: 'image/heic', size: MB })
    expect(plan.action).toBe('reject')
    expect(plan.action === 'reject' && plan.reason).toContain('Most Compatible')
  })

  it('refuses an unsupported type, including one the browser could not identify', () => {
    const pdf = planUpload({ type: 'application/pdf', size: 1024 })
    expect(pdf.action === 'reject' && pdf.reason).toContain('application/pdf')

    const unknown = planUpload({ type: '', size: 1024 })
    expect(unknown.action === 'reject' && unknown.reason).toContain('That file type')
  })

  it('honours a caller-supplied budget', () => {
    expect(planUpload({ type: 'image/jpeg', size: 2 * MB }, MB)).toEqual({ action: 'recompress' })
  })
})

describe('scaledDimensions', () => {
  it('fits the longest edge without distorting the picture', () => {
    expect(scaledDimensions(4032, 3024, 2400)).toEqual({ width: 2400, height: 1800 })
    expect(scaledDimensions(3024, 4032, 2400)).toEqual({ width: 1800, height: 2400 })
  })

  it('never upscales something already small enough', () => {
    expect(scaledDimensions(800, 600, 2400)).toEqual({ width: 800, height: 600 })
  })

  it('keeps at least one pixel on each edge', () => {
    expect(scaledDimensions(4000, 1, 100)).toEqual({ width: 100, height: 1 })
  })
})

describe('jpegFileName', () => {
  it('replaces whatever extension the pick had', () => {
    expect(jpegFileName('Sunset On The Muskingum.PNG')).toBe('Sunset On The Muskingum.jpg')
    expect(jpegFileName('IMG_4821.jpeg')).toBe('IMG_4821.jpg')
  })

  it('handles a name with no extension, and an empty one', () => {
    expect(jpegFileName('photo')).toBe('photo.jpg')
    expect(jpegFileName('.jpeg')).toBe('upload.jpg')
  })
})

describe('uploadFailureMessage', () => {
  it('prefers the route’s own error field', () => {
    expect(uploadFailureMessage(415, JSON.stringify({ error: 'Unsupported file type: image/heic' })))
      .toBe('Unsupported file type: image/heic')
  })

  it('explains a platform 413 whose body is an HTML error page', () => {
    // This is the exact shape that produced "The string did not match the expected pattern."
    const message = uploadFailureMessage(413, '<!DOCTYPE html><html><body>Request Entity Too Large</body></html>')
    expect(message).toContain('too large')
    expect(message).toContain(formatMb(UPLOAD_BUDGET_BYTES))
  })

  it('explains a signed-out admin', () => {
    expect(uploadFailureMessage(401, '')).toContain('Sign in again')
    expect(uploadFailureMessage(403, 'Forbidden')).toContain('Sign in again')
  })

  it('falls back to the status for anything else', () => {
    expect(uploadFailureMessage(502, '<html>Bad Gateway</html>')).toBe('Upload failed (HTTP 502).')
  })

  it('ignores a JSON body with no usable error field', () => {
    expect(uploadFailureMessage(500, JSON.stringify({ error: '  ' }))).toBe('Upload failed (HTTP 500).')
    expect(uploadFailureMessage(500, JSON.stringify({ detail: 'nope' }))).toBe('Upload failed (HTTP 500).')
  })
})

describe('readUploadResponse', () => {
  it('returns the uploaded media on success', async () => {
    const res = jsonResponse(201, {
      url: 'https://store.public.blob.vercel-storage.com/heat-index/1-photo.jpg',
      isVideo: false,
      media: { filename: 'photo.jpg', mimeType: 'image/jpeg' },
    })
    await expect(readUploadResponse(res)).resolves.toMatchObject({
      url: 'https://store.public.blob.vercel-storage.com/heat-index/1-photo.jpg',
      isVideo: false,
      media: { filename: 'photo.jpg' },
    })
  })

  it('never lets a non-JSON error body throw a parser error at the author', async () => {
    const res = new Response('<!DOCTYPE html><html><body>Request Entity Too Large</body></html>', {
      status: 413,
      headers: { 'content-type': 'text/html' },
    })
    await expect(readUploadResponse(res)).rejects.toThrow('too large')
  })

  it('reports a 200 that is not JSON as a failed upload', async () => {
    const res = new Response('<html>signed out</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
    await expect(readUploadResponse(res)).rejects.toThrow('did not return a result')
  })

  it('reports a success body missing the fields the editor needs', async () => {
    const res = jsonResponse(201, { url: 'https://example.test/a.jpg' })
    await expect(readUploadResponse(res)).rejects.toThrow('unexpected result')
  })
})

/**
 * `recompressImage` is the part that makes a camera photo upload at all, and jsdom has neither
 * `createImageBitmap` nor a canvas that encodes. Both are stubbed so the decisions around them —
 * which attempt wins, what happens when none does, what the result is named — can be asserted.
 */
describe('recompressImage', () => {
  interface Drawn {
    width: number
    height: number
    quality: number
  }

  /** Install the stubs and report every encode attempt, sized by `sizeFor`. */
  function stubCanvas(sizeFor: (attempt: Drawn) => number) {
    const drawn: Drawn[] = []
    let closed = false

    vi.stubGlobal('createImageBitmap', async () => ({
      width: 4032,
      height: 3024,
      close: () => {
        closed = true
      },
    }))

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: () => {},
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D)

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      _type?: string,
      quality?: number
    ) {
      const attempt = { width: this.width, height: this.height, quality: quality ?? 0 }
      drawn.push(attempt)
      callback(new Blob([new Uint8Array(sizeFor(attempt))], { type: 'image/jpeg' }))
    })

    return { drawn, wasClosed: () => closed }
  }

  const photo = () =>
    new File([new Uint8Array(16)], 'IMG_4821.HEIC.jpeg', { type: 'image/jpeg' })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stops at the first attempt that fits, and returns a JPEG', async () => {
    const { drawn, wasClosed } = stubCanvas(() => 500)

    const out = await recompressImage(photo(), 1000)

    expect(out.type).toBe('image/jpeg')
    expect(out.name).toBe('IMG_4821.HEIC.jpg')
    expect(out.size).toBe(500)
    // One encode only — it fit, so the smaller attempts are never run.
    expect(drawn).toHaveLength(1)
    expect(drawn[0]).toEqual({ width: 2400, height: 1800, quality: 0.82 })
    expect(wasClosed()).toBe(true)
  })

  it('keeps shrinking until something fits', async () => {
    // Only the third attempt (1600px) lands under the budget.
    const { drawn } = stubCanvas((a) => (a.width <= 1600 ? 900 : 5000))

    const out = await recompressImage(photo(), 1000)

    expect(out.size).toBe(900)
    expect(drawn.map((a) => a.width)).toEqual([2400, 2000, 1600])
  })

  it('refuses rather than sending something still too large', async () => {
    const { drawn, wasClosed } = stubCanvas(() => 9 * 1024 * 1024)

    await expect(recompressImage(photo(), 1000)).rejects.toThrow('9.0 MB after resizing')
    // Every attempt was spent before giving up, and the bitmap is still released.
    expect(drawn).toHaveLength(4)
    expect(wasClosed()).toBe(true)
  })

  it('says so plainly when the browser cannot decode the pick', async () => {
    vi.stubGlobal('createImageBitmap', async () => {
      throw new Error('unsupported')
    })

    await expect(recompressImage(photo(), 1000)).rejects.toThrow('could not resize it')
  })
})
