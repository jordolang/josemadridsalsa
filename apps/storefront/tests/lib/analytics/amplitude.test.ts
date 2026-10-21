// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const initAll = vi.fn()
const setOptOut = vi.fn()
const track = vi.fn()
vi.mock('@amplitude/unified', () => ({ initAll, setOptOut, track }))

async function freshModule() {
  vi.resetModules()
  return import('@/lib/analytics/amplitude')
}

beforeEach(() => {
  initAll.mockReset()
  setOptOut.mockReset()
  track.mockReset()
  vi.unstubAllEnvs()
  window.localStorage.setItem('cookie-consent', 'accepted')
})

describe('initAmplitude', () => {
  it('initializes analytics with autocapture and full session replay, once', async () => {
    vi.stubEnv('NEXT_PUBLIC_AMPLITUDE_API_KEY', 'test-key')
    const { initAmplitude } = await freshModule()

    expect(initAmplitude()).toBe(true)
    expect(initAmplitude()).toBe(true)
    await vi.dynamicImportSettled()

    expect(initAll).toHaveBeenCalledTimes(1)
    expect(initAll).toHaveBeenCalledWith('test-key', {
      analytics: { autocapture: true },
      sessionReplay: { sampleRate: 1 },
    })
  })

  it.each([null, 'rejected'])('stays off until analytics cookies are accepted (consent: %s)', async (consent) => {
    vi.stubEnv('NEXT_PUBLIC_AMPLITUDE_API_KEY', 'test-key')
    if (consent) window.localStorage.setItem('cookie-consent', consent)
    else window.localStorage.removeItem('cookie-consent')
    const { initAmplitude } = await freshModule()

    expect(initAmplitude()).toBe(false)
    await vi.dynamicImportSettled()
    expect(initAll).not.toHaveBeenCalled()
  })

  it('opts out when consent is revoked, and back in when it is given again', async () => {
    vi.stubEnv('NEXT_PUBLIC_AMPLITUDE_API_KEY', 'test-key')
    const { initAmplitude, disableAmplitude } = await freshModule()

    initAmplitude()
    await vi.dynamicImportSettled()
    disableAmplitude()
    expect(setOptOut).toHaveBeenLastCalledWith(true)

    initAmplitude()
    expect(setOptOut).toHaveBeenLastCalledWith(false)
    expect(initAll).toHaveBeenCalledTimes(1)
  })

  it('warns and stays off when the key is missing from the build', async () => {
    vi.stubEnv('NEXT_PUBLIC_AMPLITUDE_API_KEY', '')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { initAmplitude } = await freshModule()

    expect(initAmplitude()).toBe(false)
    expect(initAll).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('Amplitude API key missing — analytics disabled')
  })

  it('holds events sent while the SDK downloads, then sends them after init', async () => {
    vi.stubEnv('NEXT_PUBLIC_AMPLITUDE_API_KEY', 'test-key')
    const { initAmplitude, trackEvent } = await freshModule()

    initAmplitude()
    trackEvent('Viewed Home Page', { source: 'test' })
    expect(track).not.toHaveBeenCalled()

    await vi.dynamicImportSettled()
    expect(initAll).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('Viewed Home Page', { source: 'test' })
    expect(initAll.mock.invocationCallOrder[0]).toBeLessThan(track.mock.invocationCallOrder[0])
  })
})
