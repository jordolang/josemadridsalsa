'use client'

import { useFeatureIsOn } from '@growthbook/growthbook-react'

import type { AppFeatures } from '@/lib/growthbook'

/**
 * Demo usage of a GrowthBook feature flag. Delete or replace once you have
 * real flags in place — this exists so the integration can be verified
 * end-to-end by toggling the flag in the GrowthBook dashboard.
 */
export function GrowthBookAnnouncementBanner() {
  const enabled = useFeatureIsOn<AppFeatures>('homepage-announcement-banner')
  if (!enabled) return null
  return (
    <div
      role="status"
      className="w-full bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
    >
      Free shipping on orders over $50 — now through the weekend.
    </div>
  )
}
