import { NextResponse } from 'next/server'
import { isBusinessHours, businessHoursLabel } from '@/lib/chat/business-hours'

export const runtime = 'nodejs'

export async function GET() {
  const open = isBusinessHours()
  return NextResponse.json({
    open,
    hoursLabel: businessHoursLabel,
    timezone: 'America/New_York',
  })
}
