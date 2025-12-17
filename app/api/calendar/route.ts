import { NextResponse } from 'next/server';
import {
  getUpcomingScheduleEvents,
  GoogleCalendarNotConfiguredError,
} from '@/lib/google-calendar';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skipCache = searchParams.get('skipCache') === 'true';
    const events = await getUpcomingScheduleEvents({ skipCache });
    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof GoogleCalendarNotConfiguredError) {
      return NextResponse.json(
        {
          message:
            'Google Calendar integration is not configured. Add the required environment variables and try again.',
        },
        { status: 503 }
      );
    }

    console.error('Failed to fetch Google Calendar events', error);
    return NextResponse.json(
      { message: 'Unable to load schedule events at this time.' },
      { status: 500 }
    );
  }
}
