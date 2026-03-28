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

/**
 * Fetch Google reviews server-side.
 * Cached by Next.js for 2 hours — zero client API calls.
 */
export async function getReviewsData(): Promise<ReviewsData> {
  try {
    const PLACES_API_BASE = 'https://places.googleapis.com/v1'
    const apiKey =
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    const placeId =
      process.env.GOOGLE_PLACE_ID ||
      process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID

    if (!apiKey || !placeId) {
      return { reviews: [], totalRating: 0, totalReviews: 0 }
    }

    const response = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'reviews,rating,userRatingCount',
      },
      // Next.js ISR: revalidate every 2 hours
      next: { revalidate: 7200 },
    })

    if (!response.ok) {
      console.error('[getReviewsData] Places API error:', response.status)
      return { reviews: [], totalRating: 0, totalReviews: 0 }
    }

    const data = await response.json()

    const reviews: Review[] = (data.reviews ?? []).map((r: any) => ({
      authorName: r.authorAttribution?.displayName ?? 'Anonymous',
      rating: r.rating ?? 5,
      text: r.text?.text ?? '',
      relativePublishTime: r.publishTime
        ? new Date(r.publishTime).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : null,
    }))

    return {
      reviews,
      totalRating: data.rating ?? 0,
      totalReviews: data.userRatingCount ?? 0,
    }
  } catch (err) {
    console.error('[getReviewsData] Error:', err)
    return { reviews: [], totalRating: 0, totalReviews: 0 }
  }
}

/**
 * Fetch Google Calendar events server-side.
 * Cached by Next.js for 5 minutes — zero client API calls.
 */
export async function getCalendarEvents(limit = 25): Promise<ScheduleEvent[]> {
  try {
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY?.trim()
    const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim()

    if (!apiKey || !calendarId) {
      return []
    }

    const params = new URLSearchParams({
      key: apiKey,
      timeMin: new Date().toISOString(),
      maxResults: String(limit),
      singleEvents: 'true',
      orderBy: 'startTime',
    })

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      // Next.js ISR: revalidate every 5 minutes
      { next: { revalidate: 300 } }
    )

    if (!response.ok) {
      console.error('[getCalendarEvents] Calendar API error:', response.status)
      return []
    }

    const data = await response.json()

    return ((data.items ?? []) as any[])
      .map((item: any) => {
        const startRaw: string | null =
          item.start?.dateTime ?? item.start?.date ?? null
        const endRaw: string | null =
          item.end?.dateTime ?? item.end?.date ?? null
        const isAllDay = Boolean(item.start?.date && !item.start?.dateTime)
        return {
          id: item.id ?? `${startRaw}-${item.summary}`,
          title: item.summary ?? 'Untitled Event',
          start: startRaw,
          end: endRaw,
          location: item.location ?? null,
          description: item.description ?? null,
          link: item.htmlLink ?? null,
          isAllDay,
        }
      })
      .filter(Boolean) as ScheduleEvent[]
  } catch (err) {
    console.error('[getCalendarEvents] Error:', err)
    return []
  }
}
