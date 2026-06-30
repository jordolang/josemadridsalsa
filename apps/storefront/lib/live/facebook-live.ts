import { FACEBOOK_PAGE_URL, OFFLINE_LIVE_STATUS, type LiveStatus } from './constants'

// Match the Graph API version used elsewhere in lib/social.
const GRAPH_VERSION = 'v21.0'

/**
 * Build the Facebook video-plugin embed URL for an on-site live player.
 * `autoplay=true` so viewers drop straight into the broadcast.
 */
function toEmbedUrl(permalinkUrl: string): string {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
    permalinkUrl,
  )}&show_text=false&autoplay=true`
}

/**
 * Ask Facebook whether the configured Page is broadcasting right now.
 *
 * Requires two server-only env vars:
 *   - FACEBOOK_LIVE_PAGE_ID            the numeric Page ID to watch
 *   - FACEBOOK_LIVE_PAGE_ACCESS_TOKEN  a (long-lived) Page access token
 *
 * Returns OFFLINE when unconfigured or on any error, so the site degrades
 * cleanly to the "visit our Facebook page" fallback rather than breaking.
 */
export async function fetchFacebookLiveStatus(): Promise<LiveStatus> {
  const pageId = process.env.FACEBOOK_LIVE_PAGE_ID
  const token = process.env.FACEBOOK_LIVE_PAGE_ACCESS_TOKEN
  if (!pageId || !token) return OFFLINE_LIVE_STATUS

  try {
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/live_videos`)
    url.searchParams.set('fields', 'id,status,permalink_url,title')
    url.searchParams.set('limit', '5')
    url.searchParams.set('access_token', token)

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return OFFLINE_LIVE_STATUS

    const data = (await res.json()) as {
      error?: unknown
      data?: Array<{ status?: string; permalink_url?: string; title?: string }>
    }
    if (data.error || !Array.isArray(data.data)) return OFFLINE_LIVE_STATUS

    const live = data.data.find((v) => v.status === 'LIVE' && v.permalink_url)
    if (!live?.permalink_url) return OFFLINE_LIVE_STATUS

    const permalinkUrl = live.permalink_url.startsWith('http')
      ? live.permalink_url
      : `https://www.facebook.com${live.permalink_url}`

    return {
      isLive: true,
      permalinkUrl,
      embedUrl: toEmbedUrl(permalinkUrl),
      title: live.title ?? null,
      facebookPageUrl: FACEBOOK_PAGE_URL,
    }
  } catch {
    return OFFLINE_LIVE_STATUS
  }
}

// Throttle Graph API calls: every visitor polls /api/live/status and the /live
// page renders on request, but we only need to ask Facebook a couple of times a
// minute. Shared module-level cache so both callers collapse to one call per TTL.
const CACHE_TTL_MS = 30_000
let cache: { at: number; value: LiveStatus } | null = null

/**
 * Cached wrapper around {@link fetchFacebookLiveStatus}. Use this from request
 * handlers and pages so a burst of traffic hits Facebook at most once per 30s.
 */
export async function getLiveStatus(): Promise<LiveStatus> {
  const now = Date.now()
  if (!cache || now - cache.at > CACHE_TTL_MS) {
    cache = { at: now, value: await fetchFacebookLiveStatus() }
  }
  return cache.value
}
