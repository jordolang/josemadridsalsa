import { describe, expect, it } from 'vitest'
import { sanitizeCmsHtml } from '@/lib/cms/sanitize'

describe('sanitizeCmsHtml', () => {
  it('keeps basic formatting', () => {
    expect(sanitizeCmsHtml('<p>Hello <strong>world</strong></p>')).toBe(
      '<p>Hello <strong>world</strong></p>'
    )
  })

  it('strips script tags', () => {
    expect(sanitizeCmsHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>')
  })

  it('strips inline event handlers', () => {
    const result = sanitizeCmsHtml('<p onclick="alert(1)">text</p>')
    expect(result).not.toContain('onclick')
  })

  it('drops javascript: links', () => {
    const result = sanitizeCmsHtml('<a href="javascript:alert(1)">click</a>')
    expect(result).not.toContain('javascript:')
  })

  it('leaves internal links navigating in place', () => {
    const result = sanitizeCmsHtml('<a href="/products">Shop</a>')
    expect(result).not.toContain('target="_blank"')
  })

  it('opens external links in a new tab with a safe rel', () => {
    const result = sanitizeCmsHtml('<a href="https://example.com">Out</a>')
    expect(result).toContain('target="_blank"')
    expect(result).toContain('noopener')
  })

  it('returns an empty string for empty input', () => {
    expect(sanitizeCmsHtml(null)).toBe('')
    expect(sanitizeCmsHtml(undefined)).toBe('')
    expect(sanitizeCmsHtml('')).toBe('')
  })
})
