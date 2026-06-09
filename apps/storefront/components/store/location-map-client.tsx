'use client'

import dynamic from 'next/dynamic'

// Client-side only LocationMap wrapper for Google Maps
// Using client component to allow ssr: false configuration
export const LocationMapClient = dynamic(
  () => import('@/components/store/location-map').then(mod => ({ default: mod.LocationMap })),
  {
    loading: () => <div className="h-96 animate-pulse bg-muted rounded-lg" />,
    ssr: false // Google Maps should only load on client
  }
)
