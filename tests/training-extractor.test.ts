import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  extractTextFromUpload,
  extractTextFromUrl,
} from '@/lib/training-data/extractor'

describe('training data extractor', () => {
  describe('extractTextFromUpload', () => {
    it('reads plain text files', async () => {
      const buffer = Buffer.from('Hello Jose Madrid')
      const result = await extractTextFromUpload({
        buffer,
        fileName: 'notes.txt',
        mimeType: 'text/plain',
      })

      expect(result.status).toBe('ready')
      expect(result.text).toBe('Hello Jose Madrid')
      expect(result.title).toBe('notes')
    })

    it('flags unsupported image uploads', async () => {
      const buffer = Buffer.from('fake-image-bytes')
      const result = await extractTextFromUpload({
        buffer,
        fileName: 'photo.png',
        mimeType: 'image/png',
      })

      expect(result.status).toBe('unsupported')
      expect(result.text).toBeNull()
      expect(result.warnings[0]).toContain('Image ingestion')
    })
  })

  describe('extractTextFromUrl', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
      vi.useRealTimers()
    })

    afterEach(() => {
      global.fetch = originalFetch
      vi.restoreAllMocks()
    })

    it('scrapes HTML content and preserves titles', async () => {
      const html = `
        <html>
          <head><title>Fundraising Guide</title></head>
          <body>
            <h1>Fundraising Guide</h1>
            <p>Jose Madrid Salsa makes school fundraising simple.</p>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      )

      const result = await extractTextFromUrl('https://example.com/fundraising')
      expect(result.status).toBe('ready')
      expect(result.title).toBe('Fundraising Guide')
      expect(result.text).toContain('Jose Madrid Salsa')
    })

    it('rejects unsupported protocols', async () => {
      const result = await extractTextFromUrl('ftp://example.com/resource')
      expect(result.status).toBe('failed')
      expect(result.warnings[0]).toContain('HTTP and HTTPS')
    })

    it('handles timeouts gracefully', async () => {
      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'
      global.fetch = vi.fn().mockRejectedValue(abortError)

      const result = await extractTextFromUrl('https://example.com/slow-page')
      expect(result.status).toBe('failed')
      expect(result.warnings[0]).toContain('timed out')
    })
  })
})
