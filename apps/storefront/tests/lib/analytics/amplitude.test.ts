import { beforeEach, describe, expect, it, vi } from 'vitest'

const initAll = vi.fn()
vi.mock('@amplitude/unified', () => ({ initAll, track: vi.fn() }))

async function freshModule() {
  vi.resetModules()
  return import('@/lib/analytics/amplitude')
}

beforeEach(() => {
  initAll.mockReset()
  vi.unstubAllEnvs()
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

  it('warns and stays off when the key is missing from the build', async () => {
    vi.stubEnv('NEXT_PUBLIC_AMPLITUDE_API_KEY', '')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { initAmplitude } = await freshModule()

    expect(initAmplitude()).toBe(false)
    expect(initAll).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('Amplitude API key missing — analytics disabled')
  })
})
