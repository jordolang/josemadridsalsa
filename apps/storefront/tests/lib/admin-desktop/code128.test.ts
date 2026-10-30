import { describe, it, expect } from 'vitest'
import { CODE128_PATTERNS, code128Svg, code128Values, code128Widths } from '@/lib/admin-desktop/code128'
import { showCheckoutCodesHtml } from '@/lib/admin-desktop/show-checkout-codes'

describe('code128', () => {
  it('has a well-formed pattern for every symbol', () => {
    expect(CODE128_PATTERNS).toHaveLength(107)
    CODE128_PATTERNS.forEach((pattern, value) => {
      const widths = [...pattern].map(Number)
      // Every symbol is 11 modules (Stop is 13), and its bars add up to an even number.
      expect(widths.reduce((a, b) => a + b, 0), `symbol ${value}`).toBe(value === 106 ? 13 : 11)
      const bars = widths.filter((_, index) => index % 2 === 0).reduce((a, b) => a + b, 0)
      expect(bars % 2, `symbol ${value}`).toBe(0)
    })
    expect(new Set(CODE128_PATTERNS).size).toBe(107)
  })

  it('encodes with Start B and the mod-103 check symbol', () => {
    // 104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7 = 879, and 879 mod 103 = 55.
    expect(code128Values('PJJ123C')).toEqual([104, 48, 42, 42, 17, 18, 19, 35, 55, 106])
  })

  it('draws one bar per bar module run', () => {
    const widths = code128Widths('JD02')
    const bars = widths.filter((_, index) => index % 2 === 0).length
    expect(code128Svg('JD02').match(/<rect/g)).toHaveLength(bars)
  })

  it('refuses characters outside code set B', () => {
    expect(() => code128Values('é')).toThrow()
  })
})

describe('showCheckoutCodesHtml', () => {
  it('carries the dates and half codes and 01 to 31', () => {
    const html = showCheckoutCodesHtml()
    expect(html).toContain('>Dates<')
    expect(html).toContain('>Half case<')
    expect(html).toContain('>01<')
    expect(html).toContain('>31<')
    expect(html).not.toContain('<script')
  })
})
