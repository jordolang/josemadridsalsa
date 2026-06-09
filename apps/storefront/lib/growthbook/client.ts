import { GrowthBook } from '@growthbook/growthbook-react'

import type { AppFeatures } from './features'
import { amplitudeTrackingCallback } from './tracking'

const DEFAULT_API_HOST = 'https://cdn.growthbook.io'

let warnedMissingKey = false

/**
 * Builds a new GrowthBook instance configured for this app.
 *
 * The returned instance is unstarted — callers must invoke `init()` and
 * `setAttributes()` before reading flags. A fresh instance should be created
 * per provider mount so SSE subscriptions and caches are scoped correctly.
 */
export function createGrowthBookInstance(): GrowthBook<AppFeatures> {
  const clientKey = process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY ?? ''
  const apiHost = process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST ?? DEFAULT_API_HOST

  if (!clientKey && !warnedMissingKey && typeof window !== 'undefined') {
    warnedMissingKey = true
    // eslint-disable-next-line no-console
    console.warn(
      '[growthbook] NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY is not set; all feature flags will resolve to their defaults.',
    )
  }

  return new GrowthBook<AppFeatures>({
    apiHost,
    clientKey,
    enableDevMode: process.env.NODE_ENV !== 'production',
    subscribeToChanges: true,
    trackingCallback: amplitudeTrackingCallback,
  })
}
