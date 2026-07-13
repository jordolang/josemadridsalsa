import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Unit tests for the Facebook live-status detector.
 *
 * The module reads env vars at call time, so each test stubs the env and
 * global fetch, then re-imports the module fresh.
 */

const PAGE_ID = '123456789'
const TOKEN = 'test-page-token'

async function importDetector() {
  vi.resetModules()
  return import('@/lib/live/facebook-live')
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('fetchFacebookLiveStatus', () => {
  it('returns offline when credentials are not configured', async () => {
    vi.stubEnv('FACEBOOK_LIVE_PAGE_ID', '')
    vi.stubEnv('FACEBOOK_LIVE_PAGE_ACCESS_TOKEN', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { fetchFacebookLiveStatus } = await importDetector()
    const status = await fetchFacebookLiveStatus()

    expect(status.isLive).toBe(false)
    expect(status.embedUrl).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports live with an embed URL when a LIVE video is returned', async () => {
    vi.stubEnv('FACEBOOK_LIVE_PAGE_ID', PAGE_ID)
    vi.stubEnv('FACEBOOK_LIVE_PAGE_ACCESS_TOKEN', TOKEN)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { status: 'LIVE_STOPPED', permalink_url: '/josemadridsalsa/videos/111/' },
            {
              status: 'LIVE',
              permalink_url: '/josemadridsalsa/videos/222/',
              title: 'Salsa at the market',
            },
          ],
        }),
      }),
    )

    const { fetchFacebookLiveStatus } = await importDetector()
    const status = await fetchFacebookLiveStatus()

    expect(status.isLive).toBe(true)
    expect(status.title).toBe('Salsa at the market')
    expect(status.permalinkUrl).toBe('https://www.facebook.com/josemadridsalsa/videos/222/')
    expect(status.embedUrl).toContain('plugins/video.php')
    expect(status.embedUrl).toContain(encodeURIComponent(status.permalinkUrl!))
  })

  it('returns offline when no video has LIVE status', async () => {
    vi.stubEnv('FACEBOOK_LIVE_PAGE_ID', PAGE_ID)
    vi.stubEnv('FACEBOOK_LIVE_PAGE_ACCESS_TOKEN', TOKEN)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'VOD', permalink_url: '/x/videos/1/' }] }),
      }),
    )

    const { fetchFacebookLiveStatus } = await importDetector()
    const status = await fetchFacebookLiveStatus()

    expect(status.isLive).toBe(false)
  })

  it('returns offline when the Graph API responds with an error payload', async () => {
    vi.stubEnv('FACEBOOK_LIVE_PAGE_ID', PAGE_ID)
    vi.stubEnv('FACEBOOK_LIVE_PAGE_ACCESS_TOKEN', TOKEN)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: { message: 'Invalid token' } }),
      }),
    )

    const { fetchFacebookLiveStatus } = await importDetector()
    const status = await fetchFacebookLiveStatus()

    expect(status.isLive).toBe(false)
  })

  it('returns offline when fetch throws', async () => {
    vi.stubEnv('FACEBOOK_LIVE_PAGE_ID', PAGE_ID)
    vi.stubEnv('FACEBOOK_LIVE_PAGE_ACCESS_TOKEN', TOKEN)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    const { fetchFacebookLiveStatus } = await importDetector()
    const status = await fetchFacebookLiveStatus()

    expect(status.isLive).toBe(false)
  })
})
