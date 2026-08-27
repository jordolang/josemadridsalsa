'use client'

import { useEffect } from 'react'
import { captureFirstTouchAttribution } from '@/lib/analytics/attribution.client'

/**
 * Records first-touch marketing attribution into a cookie the moment a visitor lands, so the order
 * they later place can be tied back to its source. No-op after the first meaningful touch. Renders
 * nothing.
 */
export function AttributionTracker() {
  useEffect(() => {
    captureFirstTouchAttribution()
  }, [])

  return null
}
