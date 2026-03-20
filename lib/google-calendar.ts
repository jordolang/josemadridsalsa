/**
 * Google Calendar v3 — public calendar access via API key.
 *
 * No service account or OAuth required. The target calendar must be
 * set to "Make available to public" in Google Calendar settings.
 *
 * Required env vars:
 *   GOOGLE_CALENDAR_API_KEY  — Google Cloud API key with Calendar API enabled
 *   GOOGLE_CALENDAR_ID       — Calendar ID (set to mike@josemadridsalsa.com)
 */

const CACHE_TTL_MS = 1000 * 60 * 5; // 5-minute cache

export type ScheduleEvent = {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  location: string | null;
  description: string | null;
  link: string | null;
  isAllDay: boolean;
};

export class GoogleCalendarNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleCalendarNotConfiguredError';
  }
}

let cachedEvents: { events: ScheduleEvent[]; expiresAt: number } | null = null;

function toScheduleEvent(item: Record<string, any>): ScheduleEvent | null {
  if (!item) return null;

  const startRaw: string | null = item.start?.dateTime ?? item.start?.date ?? null;
  const endRaw: string | null   = item.end?.dateTime   ?? item.end?.date   ?? null;
  const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);

  return {
    id:          item.id ?? `${startRaw}-${item.summary}`,
    title:       item.summary ?? 'Untitled Event',
    start:       startRaw,
    end:         endRaw,
    location:    item.location   ?? null,
    description: item.description ?? null,
    link:        item.htmlLink    ?? null,
    isAllDay,
  };
}

type UpcomingEventOptions = {
  limit?: number;
  skipCache?: boolean;
};

export async function getUpcomingScheduleEvents(
  options: UpcomingEventOptions = {}
): Promise<ScheduleEvent[]> {
  const { limit = 25, skipCache = false } = options;

  const apiKey     = process.env.GOOGLE_CALENDAR_API_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!apiKey || !calendarId) {
    throw new GoogleCalendarNotConfiguredError(
      'GOOGLE_CALENDAR_API_KEY and GOOGLE_CALENDAR_ID must both be set.'
    );
  }

  const now = Date.now();
  if (!skipCache && cachedEvents && cachedEvents.expiresAt > now) {
    return cachedEvents.events;
  }

  const params = new URLSearchParams({
    key:          apiKey,
    timeMin:      new Date().toISOString(),
    maxResults:   String(limit),
    singleEvents: 'true',
    orderBy:      'startTime',
  });

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.error?.message ?? `Calendar API error: ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  const events = ((data.items ?? []) as Record<string, any>[])
    .map(toScheduleEvent)
    .filter((e): e is ScheduleEvent => Boolean(e));

  cachedEvents = { events, expiresAt: now + CACHE_TTL_MS };
  return events;
}

export function clearCalendarCache() {
  cachedEvents = null;
}
