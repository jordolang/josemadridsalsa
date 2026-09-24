'use client'

import { useEffect, useRef, useState } from 'react'

export interface DeviceLocationFix {
  latitude: number
  longitude: number
  accuracyMeters: number
  capturedAt: string
}

export type DeviceLocationStatus = 'locating' | 'on' | 'off'

/**
 * Keeps a fresh GPS fix for the kiosk. The browser asks for permission once;
 * if it's refused or unavailable the status is 'off' and waivers fall back to
 * the network location the server records.
 */
export function useDeviceLocation(): { status: DeviceLocationStatus; getFix: () => DeviceLocationFix | null } {
  const [status, setStatus] = useState<DeviceLocationStatus>('locating')
  const fixRef = useRef<DeviceLocationFix | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('off')
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        fixRef.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        }
        setStatus('on')
      },
      () => {
        // Keep the last good fix if one exists; only report off when we have nothing.
        if (!fixRef.current) setStatus('off')
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return { status, getFix: () => fixRef.current }
}
