import { NextResponse, type NextRequest } from 'next/server'
import { fail, serverError, unauthorized } from '@/lib/api'
import { buildPromoReleaseCsv, easternDateKey } from '@/lib/waivers/promoRelease'
import { listPromoReleaseEntries, parseDateKey } from '@/lib/waivers/promoReleaseLog'
import { resolveWaiverStaff } from '@/lib/waivers/staffCollector'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/waivers/promotional-release/log?date=YYYY-MM-DD[&event=…][&format=json]
 * Defaults to today (Eastern) as a CSV download.
 */
export async function GET(request: NextRequest) {
  if (!(await resolveWaiverStaff())) return unauthorized('Sign in as staff to read the waiver log')

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return fail('Waiver storage is not configured (BLOB_READ_WRITE_TOKEN missing)', 503)

  const params = request.nextUrl.searchParams
  const dateKey = parseDateKey(params.get('date') ?? undefined, easternDateKey(new Date().toISOString()))
  const event = params.get('event')?.trim()

  try {
    const entries = (await listPromoReleaseEntries(dateKey, token)).filter(
      (entry) => !event || entry.event === event,
    )

    if (params.get('format') === 'json') {
      return NextResponse.json({ date: dateKey, event: event ?? null, entries })
    }

    const suffix = event ? `-${event.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : ''
    return new NextResponse(buildPromoReleaseCsv(entries), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="waiver-log-${dateKey}${suffix}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return serverError('Could not read the waiver log', error)
  }
}
