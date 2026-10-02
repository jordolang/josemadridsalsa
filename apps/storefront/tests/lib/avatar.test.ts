import { describe, expect, it } from 'vitest'
import { detectAvatarType } from '@/lib/avatar'

const bytes = (...values: number[]) => new Uint8Array(values)

describe('detectAvatarType', () => {
  it('recognises JPEG, PNG and WebP by their magic numbers', () => {
    expect(detectAvatarType(bytes(0xff, 0xd8, 0xff, 0xe0))?.extension).toBe('jpg')
    expect(detectAvatarType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))?.extension).toBe('png')
    expect(
      detectAvatarType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))?.contentType,
    ).toBe('image/webp')
  })

  it('refuses anything else, whatever it is called', () => {
    expect(detectAvatarType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull()
    expect(detectAvatarType(new TextEncoder().encode('<html>'))).toBeNull()
    expect(detectAvatarType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20))).toBeNull() // AVI
    expect(detectAvatarType(bytes())).toBeNull()
  })
})
