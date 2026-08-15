import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_DAYS,
  buildAttribution,
  hasAttribution,
  serialiseAttribution,
} from './attribution'

/** Whether the first-touch cookie is already present (client-side). */
function attributionCookieExists(): boolean {
  return document.cookie
    .split(';')
    .some((c) => c.trim().startsWith(`${ATTRIBUTION_COOKIE}=`))
}

/**
 * Record the first meaningful touch, once.
 *
 * No-op when the cookie already exists (first touch wins) or when this landing carries nothing to
 * attribute (a purely direct visit is left uncaptured so a later campaign click can be the first
 * touch). Safe to call on every page load.
 */
export function captureFirstTouchAttribution(): void {
  if (typeof window === 'undefined') return
  if (attributionCookieExists()) return

  const fields = buildAttribution({
    params: new URLSearchParams(window.location.search),
    referrer: document.referrer || null,
    landingPage: window.location.pathname || null,
    selfHost: window.location.host || null,
  })

  if (!hasAttribution(fields)) return

  const expires = new Date(Date.now() + ATTRIBUTION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(
    serialiseAttribution(fields)
  )}; path=/; expires=${expires}; SameSite=Lax`
}
