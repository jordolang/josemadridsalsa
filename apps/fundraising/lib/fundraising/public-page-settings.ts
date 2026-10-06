/**
 * Normalisers for the fundraiser-supplied settings shown on the public
 * `/f/[subdomain]` page (advanced profile + analytics). Every value is
 * fundraiser-controlled, so each one is re-parsed at render time and only
 * https URLs on known hosts — the ones CSP `frame-src` allows — survive.
 */

function parseHttpsUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function hostOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^(www|m)\./, '')
}

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_LIST_ID = /^[A-Za-z0-9_-]{10,64}$/
const YOUTUBE_CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/
const YOUTUBE_EMBED_BASE = 'https://www.youtube-nocookie.com/embed/'

/** A YouTube video, short, live or playlist URL as a youtube-nocookie embed URL. */
export function toYouTubeEmbedUrl(raw: string | null | undefined): string | null {
  const url = parseHttpsUrl(raw)
  if (!url) return null
  const host = hostOf(url)
  const segments = url.pathname.split('/').filter(Boolean)
  const list = url.searchParams.get('list')
  const validList = list && YOUTUBE_LIST_ID.test(list) ? list : null

  let videoId: string | null = null
  if (host === 'youtu.be') {
    videoId = segments[0] ?? null
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (segments[0] === 'watch') videoId = url.searchParams.get('v')
    else if (['embed', 'shorts', 'live'].includes(segments[0] ?? '')) videoId = segments[1] ?? null
    else if (segments[0] === 'playlist' && validList) {
      return `${YOUTUBE_EMBED_BASE}videoseries?list=${validList}`
    } else if (segments[0] === 'channel' && YOUTUBE_CHANNEL_ID.test(segments[1] ?? '')) {
      return `${YOUTUBE_EMBED_BASE}live_stream?channel=${segments[1]}`
    }
  } else {
    return null
  }

  if (!videoId || !YOUTUBE_VIDEO_ID.test(videoId)) return null
  return validList
    ? `${YOUTUBE_EMBED_BASE}${videoId}?list=${validList}`
    : `${YOUTUBE_EMBED_BASE}${videoId}`
}

export type LiveStream =
  | { kind: 'iframe'; provider: 'YouTube' | 'Twitch' | 'Facebook'; src: string }
  | { kind: 'link'; provider: 'Kick'; href: string }

const TWITCH_CHANNEL = /^[A-Za-z0-9_]{3,25}$/
const TWITCH_RESERVED = new Set(['videos', 'directory', 'downloads', 'jobs', 'p', 'settings', 'subscriptions'])
const KICK_CHANNEL = /^[A-Za-z0-9_-]{3,25}$/
const HOSTNAME = /^[a-z0-9.-]+$/i

/**
 * A live-stream URL as something safe to render. Twitch's player refuses to
 * load without `parent` set to the embedding page's hostname. Kick has no
 * CSP-allowed player, so it is rendered as a link.
 */
export function toLiveStream(raw: string | null | undefined, parentHost: string): LiveStream | null {
  const url = parseHttpsUrl(raw)
  if (!url) return null
  const host = hostOf(url)
  const segments = url.pathname.split('/').filter(Boolean)

  if (host === 'youtube.com' || host === 'youtu.be') {
    const src = toYouTubeEmbedUrl(url.href)
    return src ? { kind: 'iframe', provider: 'YouTube', src } : null
  }

  if (host === 'twitch.tv') {
    const parent = parentHost.split(':')[0]
    if (!HOSTNAME.test(parent)) return null
    if (segments[0] === 'videos' && /^\d{1,15}$/.test(segments[1] ?? '')) {
      return { kind: 'iframe', provider: 'Twitch', src: `https://player.twitch.tv/?video=v${segments[1]}&parent=${parent}` }
    }
    const channel = segments[0]
    if (segments.length === 1 && channel && TWITCH_CHANNEL.test(channel) && !TWITCH_RESERVED.has(channel.toLowerCase())) {
      return { kind: 'iframe', provider: 'Twitch', src: `https://player.twitch.tv/?channel=${channel}&parent=${parent}` }
    }
    return null
  }

  if (host === 'facebook.com' || host === 'web.facebook.com') {
    const isVideo = segments.includes('videos') || segments[0] === 'watch' || segments.includes('live')
    if (!isVideo) return null
    const href = `https://www.facebook.com${url.pathname}${url.search}`
    return {
      kind: 'iframe',
      provider: 'Facebook',
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false`,
    }
  }

  if (host === 'kick.com' && segments.length === 1 && KICK_CHANNEL.test(segments[0])) {
    return { kind: 'link', provider: 'Kick', href: `https://kick.com/${segments[0]}` }
  }

  return null
}

const TIKTOK_HANDLE = /^@[A-Za-z0-9_.]{2,24}$/

/** A TikTok profile (or any URL under it) as the canonical profile link. */
export function toTikTokProfileUrl(raw: string | null | undefined): string | null {
  const url = parseHttpsUrl(raw)
  if (!url || hostOf(url) !== 'tiktok.com') return null
  const handle = url.pathname.split('/').filter(Boolean)[0]
  return handle && TIKTOK_HANDLE.test(handle) ? `https://www.tiktok.com/${handle}` : null
}

const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]{4,15}$/
const UA_PROPERTY_ID = /^UA-\d{4,10}-\d{1,4}$/

/** A Google Analytics ID (GA4 `G-…` or legacy `UA-…`), uppercased, or null. */
export function normalizeGaMeasurementId(raw: string | null | undefined): string | null {
  const id = raw?.trim().toUpperCase()
  if (!id) return null
  return GA4_MEASUREMENT_ID.test(id) || UA_PROPERTY_ID.test(id) ? id : null
}

const GOOGLE_PLACE_ID = /^ChIJ[A-Za-z0-9_-]{10,200}$/

/**
 * A Google Maps link for a business Place ID (the `ChIJ…` form), using
 * Google's documented Maps URL scheme. Any other ID shape yields null — there
 * is no public URL for a bare Business Profile location ID.
 */
export function toGooglePlaceUrl(rawPlaceId: string | null | undefined, businessName: string): string | null {
  const placeId = rawPlaceId?.trim()
  if (!placeId || !GOOGLE_PLACE_ID.test(placeId)) return null
  const params = new URLSearchParams({ api: '1', query: businessName, query_place_id: placeId })
  return `https://www.google.com/maps/search/?${params.toString()}`
}
