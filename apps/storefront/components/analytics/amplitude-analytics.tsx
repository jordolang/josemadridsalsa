'use client'

import { useEffect } from 'react'
import { disableAmplitude, initAmplitude } from '@/lib/analytics/amplitude'

/** Starts Amplitude once cookies are accepted, and stops it if they are rejected later. */
export function AmplitudeAnalytics() {
  useEffect(() => {
    initAmplitude()
    const onConsent = (event: Event) => {
      if ((event as CustomEvent<string>).detail === 'accepted') initAmplitude()
      else disableAmplitude()
    }
    window.addEventListener('cookie-consent-change', onConsent)
    return () => window.removeEventListener('cookie-consent-change', onConsent)
  }, [])

  return null
}
