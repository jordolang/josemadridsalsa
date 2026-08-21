import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_DAYS,
  buildAttribution,
  hasAttribution,
  serialiseAttribution,
  type AttributionFields,
} from './attribution'

/** localStorage key the cookie-consent banner writes ('accepted' | 'rejected' | unset). */
const COOKIE_CONSENT_KEY = 'cookie-consent'

/**
 * Whether the visitor has accepted cookies. Attribution is a marketing/analytics cookie, so it is
 * only written on explicit acceptance — never before a choice is made, and never after a rejection.
 * Reads defensively: a private-mode/SecurityError localStorage throw is treated as "no consent".
 */
function hasAnalyticsConsent(): boolean {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted'
  } catch {
    return false
  }
}

/** Whether the first-touch cookie is already present (client-side). */
function attributionCookieExists(): boolean {
  return document.cookie
    .split(';')
    .some((c) => c.trim().startsWith(`${ATTRIBUTION_COOKIE}=`))
}

/** Expire the attribution cookie — used when the visitor rejects cookies after one was written. */
export function removeAttributionCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${ATTRIBUTION_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
}

/**
 * Comfortably under the ~4KB per-cookie limit, leaving room for the name and attributes. A payload
 * over this (only reachable with long non-ASCII UTM values) has optional fields dropped rather than
 * failing the whole write silently.
 */
const MAX_ENCODED_BYTES = 3500

/** Least-important first: the fields to shed when the encoded payload is too large. */
const DROPPABLE: Array<keyof AttributionFields> = [
  'landingPage',
  'utmContent',
  'utmTerm',
  'referrer',
]

/** Encoded cookie value that fits the budget, dropping optional fields as needed. */
function fitToBudget(fields: AttributionFields): string | null {
  const working = { ...fields }
  let encoded = encodeURIComponent(serialiseAttribution(working))
  for (const key of DROPPABLE) {
    if (encoded.length <= MAX_ENCODED_BYTES) break
    if (working[key] !== null) {
      working[key] = null
      encoded = encodeURIComponent(serialiseAttribution(working))
    }
  }
  // Still over budget (e.g. one enormous utm_source) — better to record nothing than a broken write.
  return encoded.length <= MAX_ENCODED_BYTES && hasAttribution(working) ? encoded : null
}

/**
 * Record the first meaningful touch, once.
 *
 * No-op when the cookie already exists (first touch wins) or when this landing carries no marketing
 * signal (a purely direct visit is left uncaptured so a later campaign click can be the first
 * touch). Safe to call on every page load.
 */
export function captureFirstTouchAttribution(): void {
  if (typeof window === 'undefined') return
  // Respect the cookie-consent choice: capture only once the visitor has accepted.
  if (!hasAnalyticsConsent()) return
  if (attributionCookieExists()) return

  const fields = buildAttribution({
    params: new URLSearchParams(window.location.search),
    referrer: document.referrer || null,
    landingPage: window.location.pathname || null,
    selfHost: window.location.host || null,
  })

  if (!hasAttribution(fields)) return

  const encoded = fitToBudget(fields)
  if (encoded === null) return

  const expires = new Date(Date.now() + ATTRIBUTION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toUTCString()
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${ATTRIBUTION_COOKIE}=${encoded}; path=/; expires=${expires}; SameSite=Lax${secure}`
}
