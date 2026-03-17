import { NextRequest, NextResponse } from 'next/server'
import {
  getUpcomingScheduleEvents,
  GoogleCalendarNotConfiguredError,
} from '@/lib/google-calendar'
import { parseICSFile, getICSFilePath } from '@/lib/ics-parser'
import { z } from 'zod'

// Validation schema for query parameters
const queryParamsSchema = z.object({
  skipCache: z.enum(['true', 'false']).optional().default('false'),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
})

export async function GET(request: NextRequest) {
  try {
    // Public endpoint - no authentication required for public calendar display

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const params = queryParamsSchema.safeParse({
      skipCache: searchParams.get('skipCache') || 'false',
      limit: searchParams.get('limit') || '25',
    })

    if (!params.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: params.error.issues,
        },
        { status: 400 }
      )
    }

    const { skipCache, limit } = params.data

    // Fetch calendar events — try Google Calendar API first, then fall back to
    // the local .ics file when service account credentials are not configured.
    let events
    try {
      events = await getUpcomingScheduleEvents({
        skipCache: skipCache === 'true',
        limit,
      })
    } catch (gcalError) {
      if (gcalError instanceof GoogleCalendarNotConfiguredError) {
        // Graceful fallback: parse the bundled ICS file
        const icsPath = getICSFilePath()
        const allICSEvents = parseICSFile(icsPath)
        events = allICSEvents.slice(0, limit)
      } else {
        throw gcalError
      }
    }

    return NextResponse.json({ events }, { status: 200 })
  } catch (error) {
    // Google Calendar is not configured and ICS fallback also failed
    if (error instanceof GoogleCalendarNotConfiguredError) {
      return NextResponse.json(
        {
          error: 'Google Calendar integration is not configured',
          message:
            'Google Calendar integration is not configured. Add the required environment variables and try again.',
        },
        { status: 503 }
      )
    }

    // Handle generic errors
    console.error('[Calendar API] Failed to fetch Google Calendar events:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch calendar events',
        message: 'Unable to load schedule events at this time.',
      },
      { status: 500 }
    )
  }
}
