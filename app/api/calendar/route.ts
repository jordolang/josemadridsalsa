import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCalendarEvents } from '@/lib/server/google-data'

// Ensure this route is always dynamic when the refresh button passes skipCache=true.
export const dynamic = 'force-dynamic'

const queryParamsSchema = z.object({
  skipCache: z.enum(['true', 'false']).optional().default('false'),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = queryParamsSchema.safeParse({
      skipCache: searchParams.get('skipCache') || 'false',
      limit: searchParams.get('limit') || '25',
    })

    if (!params.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: params.error.issues },
        { status: 400 }
      )
    }

    const { limit } = params.data
    const events = await getCalendarEvents(limit)

    return NextResponse.json({ events }, { status: 200 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Calendar API] Failed to fetch events:', errorMessage)
    return NextResponse.json(
      {
        error: 'Failed to fetch calendar events',
        message: 'Unable to load schedule events at this time.',
      },
      { status: 500 }
    )
  }
}
