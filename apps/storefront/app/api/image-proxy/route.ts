import { NextResponse } from 'next/server'
import { getFallbackImage } from '@/lib/utils/image'

/**
 * Former Google Places photo proxy.
 *
 * It fetched a Places API (New) photo on every request, which Google bills as
 * "Place Details Photos". Location images no longer come from Google, so this route
 * makes no outside calls: it only sends pages that were cached with the old proxy
 * URLs (CDN, browsers, crawlers) to the placeholder image.
 */
export function GET() {
  return NextResponse.redirect(getFallbackImage(), {
    status: 308,
    headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
}
