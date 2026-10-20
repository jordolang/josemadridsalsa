import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPunchLocation } from '@/components/account/timeclock/getPunchLocation'

const getCurrentPosition = vi.fn()

describe('getPunchLocation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getCurrentPosition.mockReset()
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns the fix the browser reports', async () => {
    getCurrentPosition.mockImplementation(success =>
      success({ coords: { latitude: 39.94035, longitude: -82.01319, accuracy: 12 } })
    )

    await expect(getPunchLocation()).resolves.toEqual({
      latitude: 39.94035,
      longitude: -82.01319,
      accuracyMeters: 12,
    })
  })

  it('resolves null when permission is refused', async () => {
    getCurrentPosition.mockImplementation((_success, error) => error({ code: 1 }))

    await expect(getPunchLocation()).resolves.toBeNull()
  })

  it('gives up when the permission prompt is never answered', async () => {
    // The browser never calls back: its own timeout excludes prompt time.
    getCurrentPosition.mockImplementation(() => {})

    const result = getPunchLocation(10_000, 20_000)
    await vi.advanceTimersByTimeAsync(20_000)

    await expect(result).resolves.toBeNull()
  })

  it('resolves null without geolocation support', async () => {
    vi.stubGlobal('navigator', {})

    await expect(getPunchLocation()).resolves.toBeNull()
  })
})
