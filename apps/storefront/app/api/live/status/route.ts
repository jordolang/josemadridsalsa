import { NextResponse } from 'next/server'
import { getLiveStatus } from '@/lib/live/facebook-live'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await getLiveStatus()
  return NextResponse.json(status, {
    headers: { 'Cache-Control': 'public, max-age=30' },
  })
}
