/**
 * First-touch marketing attribution.
 *
 * Where a purchase came from, captured the first time a visitor lands with campaign information and
 * carried to the order they eventually place. There is no server-side cart to hang this on (the
 * cart lives in the browser), so it rides in a cookie — the same shape of precedent as the
 * abandoned-cart and fundraiser-referral cookies — read server-side at order creation.
 *
 * **First *meaningful* touch.** The cookie is written only when a landing actually carries
 * attribution — any `utm_*` parameter, or an external referrer. A purely direct visit records
 * nothing and leaves the cookie unset, so a later campaign click is still captured as the first
 * touch rather than being pre-empted by an empty "direct" cookie. Once set, it is not overwritten.
 *
 * **Never inferred, never guessed.** Every field is optional; a missing value stays null rather
 * than being back-filled from anything. Offline orders (POS/manual/phone/event) and orders placed
 * before this feature simply have none.
 *
 * This module is pure and safe to import from both server and client. The cookie *writing* lives
 * in `attribution.client.ts`; the cookie *reading* happens in the checkout routes.
 */
import { z } from 'zod'

/** Cookie name holding the JSON-encoded first-touch attribution. */
export const ATTRIBUTION_COOKIE = 'jms_attribution'

/** How long a first touch is remembered. 90 days matches a common attribution window. */
export const ATTRIBUTION_MAX_AGE_DAYS = 90

/** Per-field cap so a crafted URL cannot store an unbounded string on the order. */
const MAX_LEN = 256

/**
 * Cap a string to MAX_LEN, counting by **code point** rather than UTF-16 unit. A plain `slice`
 * could cut through a surrogate pair (an emoji, a CJK-extension char) and leave a lone surrogate,
 * which is not valid UTF-8 and can corrupt or break the write when persisted onto the order.
 */
function capLength(value: string): string {
  const points = Array.from(value)
  return points.length > MAX_LEN ? points.slice(0, MAX_LEN).join('') : value
}

// C0 control characters and DEL. NUL () is the important one: PostgreSQL rejects it in a text
// column, so a crafted `?utm_source=%00…` would otherwise make `order.create` throw and break
// checkout for anyone carrying that cookie. The rest are stripped for the same not-database-safe
// reason.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g

/** Strip control characters, then trim and length-cap — the one place a raw field is made safe. */
function sanitizeField(value: string): string {
  return capLength(value.replace(CONTROL_CHARS, '').trim())
}

export interface AttributionFields {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
  /** The referring site's host, or null for a direct/internal visit. */
  referrer: string | null
  /** The path of the first page landed on, query string stripped. */
  landingPage: string | null
}

const EMPTY: AttributionFields = {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  referrer: null,
  landingPage: null,
}

/**
 * One sanitised, length-capped field, or null when blank. Over-length values are **truncated**, not
 * rejected — the writer already caps each field, and rejecting here would throw away a whole cookie
 * (every field) over one long value. Control characters (including the PostgreSQL-fatal NUL) are
 * stripped here too, so a value read back from a tampered cookie is safe to write onto the order.
 */
const field = z
  .string()
  .transform((s) => sanitizeField(s))
  .transform((s) => (s.length > 0 ? s : null))
  .nullish()
  .transform((s) => s ?? null)

const AttributionSchema = z.object({
  utmSource: field,
  utmMedium: field,
  utmCampaign: field,
  utmTerm: field,
  utmContent: field,
  referrer: field,
  landingPage: field,
})

/**
 * The fields that constitute a real marketing signal — a UTM tag or an external referrer.
 * `landingPage` is deliberately excluded: it is context that rides along with a signal, not a signal
 * itself, and every page load has one. Counting it would set a "direct" cookie on the first visit
 * and lock out a genuine campaign click that arrives later.
 */
const SIGNAL_KEYS = [
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmTerm',
  'utmContent',
  'referrer',
] as const

/** True when there is a real marketing signal worth recording (a UTM tag or an external referrer). */
export function hasAttribution(fields: AttributionFields): boolean {
  return SIGNAL_KEYS.some((key) => fields[key] !== null)
}

/**
 * Parse and sanitise a raw cookie value into attribution fields. Returns null when the cookie is
 * absent, malformed, or carries nothing — the caller then records no attribution rather than a row
 * of nulls. Never throws: a bad cookie must not break checkout.
 */
export function parseAttributionCookie(raw: string | undefined | null): AttributionFields | null {
  if (!raw) return null

  // The value may arrive still URL-encoded (raw `document.cookie`) or already decoded (Next's
  // RequestCookies decodes for us). Try it as-is first, then decoded — never decode twice, which
  // would corrupt a value containing a literal `%` and drop the whole cookie.
  const object = tryParseJson(raw) ?? tryParseJson(safeDecodeURIComponent(raw))
  if (object === undefined) return null

  const parsed = AttributionSchema.safeParse(object)
  if (!parsed.success) return null

  const fields = { ...EMPTY, ...parsed.data }
  return hasAttribution(fields) ? fields : null
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function safeDecodeURIComponent(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/**
 * The host of a referring URL, or null when it is empty, unparseable, or the site itself.
 *
 * A `selfHost` match is treated as no referrer: an internal navigation is not a traffic source, and
 * on a genuine first landing the referrer is the external site or absent.
 */
export function referrerHost(referrer: string | null | undefined, selfHost: string | null): string | null {
  if (!referrer) return null
  try {
    const host = new URL(referrer).host
    if (!host) return null
    if (selfHost && host === selfHost) return null
    return sanitizeField(host) || null
  } catch {
    return null
  }
}

/**
 * Build first-touch fields from a landing. Pure so it can be tested without a browser: the client
 * capture passes the current query params, `document.referrer`, the landing path, and the site's
 * own host. Returns the sanitised fields (each null when absent).
 */
export function buildAttribution(input: {
  params: URLSearchParams
  referrer: string | null
  landingPage: string | null
  selfHost: string | null
}): AttributionFields {
  const get = (key: string) => {
    const value = input.params.get(key)
    if (value === null) return null
    const cleaned = sanitizeField(value)
    return cleaned.length > 0 ? cleaned : null
  }

  return {
    utmSource: get('utm_source'),
    utmMedium: get('utm_medium'),
    utmCampaign: get('utm_campaign'),
    utmTerm: get('utm_term'),
    utmContent: get('utm_content'),
    referrer: referrerHost(input.referrer, input.selfHost),
    landingPage: input.landingPage ? sanitizeField(input.landingPage) || null : null,
  }
}

/** Serialise fields to the cookie's JSON value (only the non-null keys, to keep it small). */
export function serialiseAttribution(fields: AttributionFields): string {
  const present: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) present[key] = value
  }
  return JSON.stringify(present)
}
