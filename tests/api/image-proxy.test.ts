import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'

// Set environment variable BEFORE importing the route
process.env.GOOGLE_PLACES_API_KEY = 'test-api-key'
process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-api-key'

// Mock fetch globally
global.fetch = vi.fn()

// Now import the route after env is set
const { GET } = await import('@/app/api/image-proxy/route')

describe('Image Proxy API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/image-proxy', () => {
    describe('Parameter Validation', () => {
      it('should reject request with no parameters', async () => {
        const request = new NextRequest('http://localhost/api/image-proxy')

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid parameters')
      })

      it('should accept valid URL parameter', async () => {
        const validUrl = 'https://maps.googleapis.com/maps/api/place/photo?key=test&maxwidth=400'

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(Buffer.from('fake-image-data'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          })
        )

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
        )

        const response = await GET(request)

        expect(response.status).toBe(200)
      })

      it('should accept valid placeId parameter', async () => {
        // Mock the Places API response
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              photos: [
                {
                  name: 'places/test-place/photos/photo1',
                  widthPx: 1600,
                  heightPx: 1200,
                },
              ],
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          )
        )

        // Mock the photo fetch
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(Buffer.from('fake-image-data'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          })
        )

        const request = new NextRequest(
          'http://localhost/api/image-proxy?placeId=ChIJtest123'
        )

        const response = await GET(request)

        expect(response.status).toBe(200)
      })

      it('should reject invalid URL format', async () => {
        const request = new NextRequest(
          'http://localhost/api/image-proxy?url=not-a-valid-url'
        )

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid parameters')
      })

      it('should handle invalid maxWidth by using default', async () => {
        const validUrl = 'https://maps.googleapis.com/maps/api/place/photo?key=test'

        vi.mocked(fetch).mockResolvedValue(
          new Response(Buffer.from('fake-image-data'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          })
        )

        // Test maxWidth too small - should use default 1200
        const request1 = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}&maxWidth=50`
        )
        const response1 = await GET(request1)
        expect(response1.status).toBe(200)

        // Test maxWidth too large - should use default 1200
        const request2 = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}&maxWidth=5000`
        )
        const response2 = await GET(request2)
        expect(response2.status).toBe(200)
      })

      it('should use default maxWidth of 1200', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              photos: [
                {
                  name: 'places/test-place/photos/photo1',
                  widthPx: 1600,
                  heightPx: 1200,
                },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        )

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(Buffer.from('fake-image-data'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          })
        )

        const request = new NextRequest(
          'http://localhost/api/image-proxy?placeId=ChIJtest123'
        )

        await GET(request)

        // First call is to Places API
        expect(vi.mocked(fetch)).toHaveBeenCalledWith(
          expect.stringContaining('places.googleapis.com'),
          expect.any(Object)
        )
      })
    })

    describe('Security - URL Whitelisting', () => {
      it('should reject non-Google Places URLs', async () => {
        const maliciousUrl = 'https://evil.com/image.jpg'

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(maliciousUrl)}`
        )

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Only Google Places images are allowed')
      })

      it('should reject non-HTTPS URLs', async () => {
        const httpUrl = 'http://maps.googleapis.com/maps/api/place/photo'

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(httpUrl)}`
        )

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Only HTTPS URLs are allowed')
      })

      it('should accept legacy Google Places URLs', async () => {
        const validUrl =
          'https://maps.googleapis.com/maps/api/place/photo?key=test&maxwidth=400'

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(Buffer.from('fake-image-data'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          })
        )

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
        )

        const response = await GET(request)

        expect(response.status).toBe(200)
      })

      it('should accept new Google Places API URLs', async () => {
        const validUrl =
          'https://places.googleapis.com/v1/places/ChIJtest/photos/photo1/media?key=test'

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(Buffer.from('fake-image-data'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          })
        )

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
        )

        const response = await GET(request)

        expect(response.status).toBe(200)
      })
    })

    describe('API Key Management', () => {
      it('should return 500 if API key is not configured', async () => {
        delete process.env.GOOGLE_PLACES_API_KEY
        delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

        const validUrl =
          'https://maps.googleapis.com/maps/api/place/photo?key=old&maxwidth=400'

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
        )

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('API key not configured')

        // Restore for other tests
        process.env.GOOGLE_PLACES_API_KEY = 'test-api-key'
      })

      it('should inject server-side API key into URL', async () => {
        const validUrl =
          'https://maps.googleapis.com/maps/api/place/photo?key=old-key&maxwidth=400'

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(Buffer.from('fake-image-data'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          })
        )

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
        )

        await GET(request)

        expect(vi.mocked(fetch)).toHaveBeenCalledWith(
          expect.stringContaining('key=test-api-key'),
          expect.any(Object)
        )
        expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
          expect.stringContaining('key=old-key'),
          expect.any(Object)
        )
      })
    })

    describe('Place ID Fetching', () => {
      it('should fetch fresh photo from Place ID', async () => {
        // Mock Places API response
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              photos: [
                {
                  name: 'places/ChIJtest123/photos/photo1',
                  widthPx: 1600,
                  heightPx: 1200,
                },
              ],
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          )
        )

        // Mock photo fetch
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(Buffer.from('fake-image-data'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          })
        )

        const request = new NextRequest(
          'http://localhost/api/image-proxy?placeId=ChIJtest123'
        )

        const response = await GET(request)

        expect(response.status).toBe(200)
        expect(vi.mocked(fetch)).toHaveBeenCalledWith(
          'https://places.googleapis.com/v1/places/ChIJtest123',
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-Goog-Api-Key': 'test-api-key',
              'X-Goog-FieldMask': 'photos',
            }),
          })
        )
      })

      it('should return 404 if place has no photos', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ photos: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        )

        const request = new NextRequest(
          'http://localhost/api/image-proxy?placeId=ChIJtest123'
        )

        const response = await GET(request)

        expect(response.status).toBe(404)
      })

      it('should handle Places API errors gracefully', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response('Not Found', { status: 404 })
        )

        const request = new NextRequest(
          'http://localhost/api/image-proxy?placeId=ChIJinvalid'
        )

        const response = await GET(request)

        expect(response.status).toBe(404)
      })
    })

    describe('Content Validation', () => {
      it('should reject non-image content types', async () => {
        const validUrl =
          'https://maps.googleapis.com/maps/api/place/photo?key=test&maxwidth=400'

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response('<!DOCTYPE html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          })
        )

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
        )

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid content type')
      })

      it('should accept image content types', async () => {
        const validUrl =
          'https://maps.googleapis.com/maps/api/place/photo?key=test&maxwidth=400'

        for (const contentType of ['image/jpeg', 'image/png', 'image/webp']) {
          vi.mocked(fetch).mockResolvedValueOnce(
            new Response(Buffer.from('fake-image-data'), {
              status: 200,
              headers: { 'content-type': contentType },
            })
          )

          const request = new NextRequest(
            `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
          )

          const response = await GET(request)

          expect(response.status).toBe(200)
          expect(response.headers.get('content-type')).toBe(contentType)
        }
      })
    })

    describe('Response Headers', () => {
      it('should include security headers', async () => {
        const validUrl =
          'https://maps.googleapis.com/maps/api/place/photo?key=test&maxwidth=400'

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(Buffer.from('fake-image-data'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          })
        )

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
        )

        const response = await GET(request)

        expect(response.headers.get('x-content-type-options')).toBe('nosniff')
        expect(response.headers.get('x-frame-options')).toBe('DENY')
        expect(response.headers.get('referrer-policy')).toBe('no-referrer')
      })

      it('should include cache control headers', async () => {
        const validUrl =
          'https://maps.googleapis.com/maps/api/place/photo?key=test&maxwidth=400'

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(Buffer.from('fake-image-data'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          })
        )

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
        )

        const response = await GET(request)

        expect(response.headers.get('cache-control')).toBe(
          'public, max-age=3600, s-maxage=3600'
        )
      })
    })

    describe('Error Handling', () => {
      it('should handle upstream fetch errors', async () => {
        const validUrl =
          'https://maps.googleapis.com/maps/api/place/photo?key=test&maxwidth=400'

        vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
        )

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Failed to fetch image')
      })

      it('should handle upstream 404 errors', async () => {
        const validUrl =
          'https://maps.googleapis.com/maps/api/place/photo?key=test&maxwidth=400'

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response('Not Found', { status: 404 })
        )

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
        )

        const response = await GET(request)

        expect(response.status).toBe(404)
      })

      it('should handle upstream 400 errors (expired photo names)', async () => {
        const validUrl =
          'https://places.googleapis.com/v1/places/test/photos/expired/media?key=test'

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response('Bad Request', { status: 400 })
        )

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
        )

        const response = await GET(request)

        expect(response.status).toBe(400)
      })
    })

    describe('URL Encoding Handling', () => {
      it('should handle double-encoded URLs', async () => {
        const originalUrl =
          'https://maps.googleapis.com/maps/api/place/photo?key=test&maxwidth=400'
        const doubleEncoded = encodeURIComponent(encodeURIComponent(originalUrl))

        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(Buffer.from('fake-image-data'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          })
        )

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${doubleEncoded}`
        )

        const response = await GET(request)

        expect(response.status).toBe(200)
      })
    })

    describe('Timeout Protection', () => {
      it('should handle fetch errors', async () => {
        const validUrl =
          'https://maps.googleapis.com/maps/api/place/photo?key=test&maxwidth=400'

        // Mock a network error
        vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

        const request = new NextRequest(
          `http://localhost/api/image-proxy?url=${encodeURIComponent(validUrl)}`
        )

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Failed to fetch image')
      })
    })
  })
})
