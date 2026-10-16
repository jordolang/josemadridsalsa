import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getFallbackImage } from '@/lib/utils/image'

const { GET } = await import('@/app/api/image-proxy/route')

describe('GET /api/image-proxy', () => {
  beforeEach(() => {
    // MSW replaces globalThis.fetch in beforeAll; install the spy afterwards.
    global.fetch = vi.fn()
  })

  it('redirects to the placeholder image without calling Google', () => {
    const response = GET()

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(getFallbackImage())
    expect(response.headers.get('cache-control')).toContain('max-age=31536000')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
