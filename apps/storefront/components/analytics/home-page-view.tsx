'use client'

import { useEffect } from 'react'
import { amplitude, initAmplitude } from '@/lib/analytics/amplitude'

/** Sends `Viewed Home Page` on mount. Inits first: React runs this child's effect before the layout's. */
export function HomePageView() {
  useEffect(() => {
    if (!initAmplitude()) return
    amplitude.track('Viewed Home Page', { prompt_version: 'BA400.4' }) // helps improve this setup flow — safe to remove once you've verified the event lands
  }, [])

  return null
}
