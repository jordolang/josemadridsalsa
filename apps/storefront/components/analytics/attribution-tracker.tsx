'use client'

import { useEffect } from 'react'
import {
  captureFirstTouchAttribution,
  removeAttributionCookie,
} from '@/lib/analytics/attribution.client'

/**
 * Records first-touch marketing attribution into a cookie the moment a visitor lands, so the order
 * they later place can be tied back to its source. Gated on cookie consent: it captures only after
 * the visitor accepts, and clears any existing cookie if they reject. No-op after the first
 * meaningful touch. Renders nothing.
 */
export function AttributionTracker() {
  useEffect(() => {
    // Try immediately — a no-op unless consent has already been accepted on a prior visit.
    captureFirstTouchAttribution()

    // The banner dispatches this when the visitor accepts or rejects. On accept, capture from the
    // current landing (if they're still on it); on reject, remove any cookie already written.
    const onConsentChange = (event: Event) => {
      const detail = (event as CustomEvent<'accepted' | 'rejected'>).detail
      if (detail === 'accepted') captureFirstTouchAttribution()
      else if (detail === 'rejected') removeAttributionCookie()
    }

    window.addEventListener('cookie-consent-change', onConsentChange)
    return () => window.removeEventListener('cookie-consent-change', onConsentChange)
  }, [])

  return null
}
