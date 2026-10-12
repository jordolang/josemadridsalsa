import { describe, it, expect } from 'vitest'
import { hexColor, uploadedImageUrl } from '@/lib/fundraising/signup-fields'

describe('uploadedImageUrl', () => {
  it('accepts our UploadThing hosts', () => {
    expect(uploadedImageUrl.safeParse('https://utfs.io/f/abc.png').success).toBe(true)
    expect(uploadedImageUrl.safeParse('https://x1y2.ufs.sh/f/abc.png').success).toBe(true)
  })

  it('rejects any other image, and plain http', () => {
    expect(uploadedImageUrl.safeParse('https://evil.example/logo.png').success).toBe(false)
    expect(uploadedImageUrl.safeParse('https://utfs.io.evil.example/f/a.png').success).toBe(false)
    expect(uploadedImageUrl.safeParse('http://utfs.io/f/abc.png').success).toBe(false)
  })
})

describe('hexColor', () => {
  it('takes a six-digit hex color only', () => {
    expect(hexColor.safeParse('#C8102E').success).toBe(true)
    expect(hexColor.safeParse('red').success).toBe(false)
    expect(hexColor.safeParse('#fff').success).toBe(false)
  })
})
