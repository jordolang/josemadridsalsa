import { NextRequest, NextResponse } from 'next/server'
import {
  getUpcomingScheduleEvents,
  GoogleCalendarNotConfiguredError,
} from '@/lib/google-calendar'
import { requirePermission } from '@/lib/rbac'
import { z } from 'zod'

// Validation schema for query parameters
const queryParamsSchema = z.object({
  skipCache: z.enum(['true', 'false']).optional().default('false'),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
})

export async function GET(request: NextRequest) {
  try {
    // Require authentication and calendar:read permission
    await requirePermission('calendar:read')

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

    // Fetch calendar events
    const events = await getUpcomingScheduleEvents({
      skipCache: skipCache === 'true',
      limit,
    })

    return NextResponse.json({ events }, { status: 200 })
  } catch (error) {
    // Handle specific Google Calendar errors
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

    // Handle authentication/authorization errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Authentication required to access calendar events',
        },
        { status: 401 }
      )
    }

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Insufficient permissions to access calendar events',
        },
        { status: 403 }
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
