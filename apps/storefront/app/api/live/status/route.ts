import { NextResponse } from 'next/server'
import { fetchFacebookLiveStatus } from '@/lib/live/facebook-live'
import type { LiveStatus } from '@/lib/live/constants'

export const dynamic = 'force-dynamic'

// Throttle Graph API calls: every visitor polls this endpoint, but we only need
// to ask Facebook a couple of times a minute. Cached on the warm instance.
const CACHE_TTL_MS = 30_000
let cached: { at: number; value: LiveStatus } | null = null

export async function GET() {
  const now = Date.now()
  if (!cached || now - cached.at > CACHE_TTL_MS) {
    cached = { at: now, value: await fetchFacebookLiveStatus() }
  }
  return NextResponse.json(cached.value, {
    headers: { 'Cache-Control': 'public, max-age=30' },
  })
}
