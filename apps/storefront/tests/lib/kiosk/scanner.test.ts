import { describe, expect, it } from 'vitest'
import { createScanBuffer } from '@/lib/kiosk/scanner'

const scan = (feed: ReturnType<typeof createScanBuffer>, text: string, start: number, gap = 10) => {
  let out: string | null = null
  ;[...text, 'Enter'].forEach((k, i) => {
    out = feed(k, start + i * gap) ?? out
  })
  return out
}

describe('createScanBuffer', () => {
  it('returns a fast burst that ends in Enter', () => {
    expect(scan(createScanBuffer(), '093662452973', 0)).toBe('093662452973')
  })

  it('ignores slow human typing', () => {
    expect(scan(createScanBuffer(), '093662452973', 0, 200)).toBeNull()
  })

  it('ignores short bursts and stray keys', () => {
    const feed = createScanBuffer()
    expect(scan(feed, '12', 0)).toBeNull()
    expect(feed('Shift', 1000)).toBeNull()
    expect(scan(feed, '093662452973', 2000)).toBe('093662452973')
  })
})
