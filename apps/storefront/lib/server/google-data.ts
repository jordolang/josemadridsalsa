/**
 * Server-side data fetchers for Google APIs.
 *
 * These run ONCE at page render time (Next.js server component).
 * Data is embedded in the HTML — no client-side fetch needed.
 *
 * Next.js deduplicates identical fetch() calls within a single render,
 * so even if two components call these functions, the HTTP request only
 * fires once per page render on the server.
 *
 * Cache policy:
 *   - Reviews: revalidate every 2 hours (ISR)
 *   - Calendar events: revalidate every 5 minutes (ISR)
 */

export type Review = {
  authorName: string
  rating: number
  text: string
  relativePublishTime: string | null
  profilePhotoUrl: string | null
}

export type ReviewsData = {
  reviews: Review[]
  totalRating: number
  totalReviews: number
}

export type ScheduleEvent = {
  id: string
  title: string
  start: string | null
  end: string | null
  location: string | null
  description: string | null
  link: string | null
  isAllDay: boolean
}

let warnedMissingReviewsConfig = false
let warnedMissingCalendarConfig = false

/**
 * Fetch Google reviews server-side using the legacy Places API (Place Details).
 *
 * Why legacy: the newer Places API (New) at `places.googleapis.com/v1` is not
 * enabled on the Google Cloud project, while the legacy endpoint at
 * `maps.googleapis.com/maps/api/place/details/json` works with the same key.
 *
 * Cached by Next.js for 2 hours — zero client API calls.
 */
export async function getReviewsData(): Promise<ReviewsData> {
  try {
    const apiKey =
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    const placeId =
      process.env.GOOGLE_PLACE_ID ||
      process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID

    if (!apiKey || !placeId) {
      if (!warnedMissingReviewsConfig) {
        console.warn('[getReviewsData] Missing GOOGLE_PLACES_API_KEY or GOOGLE_PLACE_ID')
        warnedMissingReviewsConfig = true
      }
      return { reviews: [], totalRating: 0, totalReviews: 0 }
    }

    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'reviews,rating,user_ratings_total,name',
      key: apiKey,
    })

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
        // Next.js ISR: revalidate every 2 hours
        next: { revalidate: 7200 },
      }
    )

    if (!response.ok) {
      console.error('[getReviewsData] Places API error:', response.status)
      return { reviews: [], totalRating: 0, totalReviews: 0 }
    }

    const data = await response.json()

    if (data.status && data.status !== 'OK') {
      console.error('[getReviewsData] Places API status:', data.status, data.error_message)
      return { reviews: [], totalRating: 0, totalReviews: 0 }
    }

    const result = data.result ?? {}

    const reviews: Review[] = (result.reviews ?? []).map((r: any): Review => ({
      authorName: r.author_name ?? 'Anonymous',
      rating: typeof r.rating === 'number' ? r.rating : 5,
      text: r.text ?? '',
      relativePublishTime: r.relative_time_description ?? null,
      profilePhotoUrl: r.profile_photo_url ?? null,
    }))

    return {
      reviews,
      totalRating: typeof result.rating === 'number' ? result.rating : 0,
      totalReviews: typeof result.user_ratings_total === 'number' ? result.user_ratings_total : 0,
    }
  } catch (err) {
    console.error('[getReviewsData] Error:', err)
    return { reviews: [], totalRating: 0, totalReviews: 0 }
  }
}

/**
 * Unescape an ICS text value per RFC 5545 §3.3.11.
 * Handles backslash, comma, semicolon, and newline escapes.
 */
function unescapeIcsText(value: string): string {
  return value
    .replace(/\\\\/g, '\u0000') // temporarily protect escaped backslashes
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\n/gi, '\n')
    .replace(/\u0000/g, '\\')
}

/**
 * Parse an ICS DATE (YYYYMMDD) or DATE-TIME (YYYYMMDDTHHMMSS[Z]) value.
 */
function parseIcsDate(raw: string): { iso: string; isAllDay: boolean } | null {
  const trimmed = raw.trim()
  const dateMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (dateMatch) {
    const [, y, m, d] = dateMatch
    return { iso: `${y}-${m}-${d}T00:00:00.000Z`, isAllDay: true }
  }
  const dtMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/)
  if (dtMatch) {
    const [, y, mo, d, h, mi, s, z] = dtMatch
    const iso = z
      ? `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`
      : `${y}-${mo}-${d}T${h}:${mi}:${s}`
    return { iso, isAllDay: false }
  }
  return null
}

type ParsedVEvent = {
  SUMMARY?: string
  LOCATION?: string
  DESCRIPTION?: string
  UID?: string
  DTSTART?: string
  DTEND?: string
  _dtstartAllDay?: boolean
}

/**
 * Parse a public Google Calendar ICS feed into simplified events.
 *
 * Only VEVENTs whose start date is in the future are returned, sorted
 * ascending and truncated to `limit`.
 */
function parseIcsFeed(icsText: string, limit: number): ScheduleEvent[] {
  // RFC 5545 line unfolding: continuation lines start with space or tab.
  const unfolded = icsText.replace(/\r?\n[\t ]/g, '')
  const lines = unfolded.split(/\r?\n/)

  const events: ScheduleEvent[] = []
  let current: ParsedVEvent | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current) {
        const summary = current.SUMMARY ?? 'Untitled Event'
        const location = current.LOCATION ?? null
        const description = current.DESCRIPTION ?? null
        const uid = current.UID ?? `${current.DTSTART ?? ''}-${summary}`

        const startParsed = current.DTSTART ? parseIcsDate(current.DTSTART) : null
        const endParsed = current.DTEND ? parseIcsDate(current.DTEND) : null

        if (startParsed) {
          events.push({
            id: uid,
            title: summary,
            start: startParsed.iso,
            end: endParsed?.iso ?? null,
            location,
            description,
            link: null,
            isAllDay: Boolean(current._dtstartAllDay ?? startParsed.isAllDay),
          })
        }
      }
      current = null
      continue
    }

    if (!current) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const rawKey = line.slice(0, colonIdx)
    const value = line.slice(colonIdx + 1)

    const semiIdx = rawKey.indexOf(';')
    const key = (semiIdx === -1 ? rawKey : rawKey.slice(0, semiIdx)).toUpperCase()
    const params = semiIdx === -1 ? '' : rawKey.slice(semiIdx + 1).toUpperCase()
    const isDateOnly = params.includes('VALUE=DATE')

    switch (key) {
      case 'SUMMARY':
        current.SUMMARY = unescapeIcsText(value)
        break
      case 'LOCATION':
        current.LOCATION = unescapeIcsText(value)
        break
      case 'DESCRIPTION':
        current.DESCRIPTION = unescapeIcsText(value)
        break
      case 'UID':
        current.UID = unescapeIcsText(value)
        break
      case 'DTSTART':
        current.DTSTART = value
        if (isDateOnly) current._dtstartAllDay = true
        break
      case 'DTEND':
        current.DTEND = value
        break
      default:
        break
    }
  }

  const now = Date.now()
  return events
    .filter((e) => {
      if (!e.start) return false
      // Online meetings (webinars, Zoom/Meet calls) that land on the calendar are
      // not stops anyone can visit, so keep them off the public schedule.
      if (isOnlineMeetingLocation(e.location)) return false
      const t = Date.parse(e.start)
      if (Number.isNaN(t)) return false
      return t >= now
    })
    .sort((a, b) => {
      const ta = Date.parse(a.start ?? '') || 0
      const tb = Date.parse(b.start ?? '') || 0
      return ta - tb
    })
    .slice(0, limit)
}

/** True when an event's location is a meeting link rather than a place. */
export function isOnlineMeetingLocation(location: string | null | undefined): boolean {
  const value = location?.trim()
  if (!value) return false
  return /^(https?:\/\/|www\.)/i.test(value) || /\b(zoom\.us|meet\.google\.com|teams\.microsoft\.com|webex\.com)\b/i.test(value)
}

/**
 * Fetch upcoming events from the Google Calendar public ICS feed.
 *
 * Why ICS: the Google Calendar v3 Events.List API is blocked on our API key
 * (API_KEY_SERVICE_BLOCKED). The public ICS feed works with no credentials as
 * long as the calendar is set to "Make available to public" in its settings.
 *
 * Cached by Next.js for 5 minutes — zero client API calls.
 */
export async function getCalendarEvents(limit = 25): Promise<ScheduleEvent[]> {
  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim()

    if (!calendarId) {
      if (!warnedMissingCalendarConfig) {
        console.warn('[getCalendarEvents] GOOGLE_CALENDAR_ID is not set')
        warnedMissingCalendarConfig = true
      }
      return []
    }

    const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      // Next.js ISR: revalidate every 5 minutes
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      console.error('[getCalendarEvents] ICS fetch error:', response.status)
      return []
    }

    const icsText = await response.text()
    return parseIcsFeed(icsText, limit)
  } catch (err) {
    console.error('[getCalendarEvents] Error:', err)
    return []
  }
}
