import { beforeEach, describe, expect, it, vi } from 'vitest'

const initAll = vi.fn()
const setOptOut = vi.fn()
vi.mock('@amplitude/unified', () => ({ initAll, setOptOut, track: vi.fn() }))

async function freshModule() {
  vi.resetModules()
  return import('@/lib/analytics/amplitude')
}

beforeEach(() => {
  initAll.mockReset()
  setOptOut.mockReset()
  vi.unstubAllEnvs()
  window.localStorage.setItem('cookie-consent', 'accepted')
})

describe('initAmplitude', () => {
  it('initializes analytics with autocapture and full session replay, once', async () => {
    vi.stubEnv('NEXT_PUBLIC_AMPLITUDE_API_KEY', 'test-key')
    const { initAmplitude } = await freshModule()

    expect(initAmplitude()).toBe(true)
    expect(initAmplitude()).toBe(true)

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
    expect(initAll).not.toHaveBeenCalled()
  })

  it('opts out when consent is revoked, and back in when it is given again', async () => {
    vi.stubEnv('NEXT_PUBLIC_AMPLITUDE_API_KEY', 'test-key')
    const { initAmplitude, disableAmplitude } = await freshModule()

    initAmplitude()
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
})
