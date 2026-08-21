'use client'

import { useEffect } from 'react'
import {
  captureFirstTouchAttribution,
  readCookieConsent,
  removeAttributionCookie,
} from '@/lib/analytics/attribution.client'

/**
 * Records first-touch marketing attribution into a cookie the moment a visitor lands, so the order
 * they later place can be tied back to its source. Gated on cookie consent: it captures only after
 * the visitor accepts, and clears any existing cookie if they reject — including a stale cookie left
 * over from before a returning visitor's rejection. No-op after the first meaningful touch. Renders
 * nothing.
 */
export function AttributionTracker() {
  useEffect(() => {
    // Reconcile against the *stored* choice on mount. A returning visitor never re-clicks the
    // banner, so the event below never fires for them: an already-rejected visitor must have any
    // leftover cookie removed here (not just via the click handler), and an already-accepted one
    // gets their first touch captured.
    const consent = readCookieConsent()
    if (consent === 'accepted') captureFirstTouchAttribution()
    else if (consent === 'rejected') removeAttributionCookie()

    // The banner dispatches this when the visitor makes or changes a choice in this session.
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
