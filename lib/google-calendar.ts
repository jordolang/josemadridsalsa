import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const CACHE_TTL_MS = 1000 * 60 * 5;

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
let cachedClient: ReturnType<typeof createServiceAccountClient> | null = null;

function createServiceAccountClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const impersonatedUser = process.env.GOOGLE_CALENDAR_IMPERSONATED_USER;

  if (!clientEmail || !privateKey) {
    throw new GoogleCalendarNotConfiguredError(
      'Google service account credentials are not fully configured.'
    );
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
    subject: impersonatedUser || undefined,
  });
}

function getCachedClient() {
  if (!cachedClient) {
    cachedClient = createServiceAccountClient();
  }
  return cachedClient;
}

function toScheduleEvent(event: calendar_v3.Schema$Event | null): ScheduleEvent | null {
  if (!event) return null;

  const id =
    event.id ||
    `${event.start?.dateTime || event.start?.date || 'unknown'}-${event.summary || 'untitled'}`;

  const startRaw = event.start?.dateTime || event.start?.date || null;
  const endRaw = event.end?.dateTime || event.end?.date || null;
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);

  return {
    id,
    title: event.summary || 'Untitled Event',
    start: startRaw,
    end: endRaw,
    location: event.location || null,
    description: event.description || null,
    link: event.htmlLink || null,
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
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!calendarId) {
    throw new GoogleCalendarNotConfiguredError('GOOGLE_CALENDAR_ID is not set.');
  }

  const now = Date.now();
  if (!skipCache && cachedEvents && cachedEvents.expiresAt > now) {
    return cachedEvents.events;
  }

  const authClient = getCachedClient();

  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const response = await calendar.events.list({
    calendarId,
    maxResults: limit,
    singleEvents: true,
    orderBy: 'startTime',
    timeMin: new Date().toISOString(),
  });

  const events = (response.data.items || [])
    .map((item) => toScheduleEvent(item))
    .filter((item): item is ScheduleEvent => Boolean(item));

  cachedEvents = {
    events,
    expiresAt: now + CACHE_TTL_MS,
  };

  return events;
}

export function clearCalendarCache() {
  cachedEvents = null;
}
