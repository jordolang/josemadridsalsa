import { describe, expect, it } from 'vitest'
import { isOnlineMeetingLocation } from '@/lib/server/google-data'

describe('isOnlineMeetingLocation', () => {
  it('flags meeting links', () => {
    expect(isOnlineMeetingLocation('https://us06web.zoom.us/j/123')).toBe(true)
    expect(isOnlineMeetingLocation('meet.google.com/abc-defg-hij')).toBe(true)
  })

  it('keeps real places', () => {
    expect(isOnlineMeetingLocation('Minneapolis Convention Center, 1301 2nd Ave S, Minneapolis, MN 55404, USA')).toBe(false)
    expect(isOnlineMeetingLocation(null)).toBe(false)
  })
})
