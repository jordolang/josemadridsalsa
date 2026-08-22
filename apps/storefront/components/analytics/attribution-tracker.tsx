'use client'

import { useEffect } from 'react'
import {
  buildFirstTouchSnapshot,
  persistFirstTouch,
  readCookieConsent,
  removeAttributionCookie,
} from '@/lib/analytics/attribution.client'

/**
 * Records first-touch marketing attribution into a cookie, so the order a visitor later places can
 * be tied back to its source. Gated on cookie consent: it persists only after the visitor accepts,
 * and clears any existing cookie if they reject — including a stale cookie left over from before a
 * returning visitor's rejection. Renders nothing.
 */
export function AttributionTracker() {
  useEffect(() => {
    // Snapshot the landing's attribution in memory at mount, *before* any consent choice. The
    // public layout stays mounted across client-side navigation, so if the visitor arrives from a
    // UTM link, navigates, and only then accepts, `window.location` no longer has the params —
    // persisting this snapshot (rather than re-reading the URL on accept) keeps that first touch.
    const snapshot = buildFirstTouchSnapshot()

    // Reconcile against the *stored* choice on mount. A returning visitor never re-clicks the
    // banner, so the event below never fires for them: an already-rejected visitor must have any
    // leftover cookie removed here, and an already-accepted one gets their first touch persisted.
    const consent = readCookieConsent()
    if (consent === 'accepted') persistFirstTouch(snapshot)
    else if (consent === 'rejected') removeAttributionCookie()

    // The banner dispatches this when the visitor makes or changes a choice in this session.
    const onConsentChange = (event: Event) => {
      const detail = (event as CustomEvent<'accepted' | 'rejected'>).detail
      if (detail === 'accepted') persistFirstTouch(snapshot)
      else if (detail === 'rejected') removeAttributionCookie()
    }

    window.addEventListener('cookie-consent-change', onConsentChange)
    return () => window.removeEventListener('cookie-consent-change', onConsentChange)
  }, [])

  return null
}
