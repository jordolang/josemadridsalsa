/**
 * Shared, client-safe Live primitives.
 *
 * This module never touches secrets, so it can be imported from both client
 * components (the nav Live tab) and server code (the /live page + API route).
 */

export interface LiveStatus {
  /** True only when the Facebook Page currently has a video with status LIVE. */
  isLive: boolean
  /** Absolute permalink to the live video on Facebook, when live. */
  permalinkUrl: string | null
  /** Facebook video-plugin embed URL for on-site playback, when live. */
  embedUrl: string | null
  /** Broadcast title/description, when available. */
  title: string | null
  /** Always-available link to the Facebook page (offline fallback target). */
  facebookPageUrl: string
}

/** Public Facebook page URL. Used as the offline fallback for the Live tab. */
export const FACEBOOK_PAGE_URL =
  process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL ?? 'https://www.facebook.com/josemadridsalsa'

/** Default "not live" status, shared so client and server agree on the shape. */
export const OFFLINE_LIVE_STATUS: LiveStatus = {
  isLive: false,
  permalinkUrl: null,
  embedUrl: null,
  title: null,
  facebookPageUrl: FACEBOOK_PAGE_URL,
}
