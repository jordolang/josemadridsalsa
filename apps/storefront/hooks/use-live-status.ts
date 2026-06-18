'use client'

import { useEffect, useState } from 'react'
import { OFFLINE_LIVE_STATUS, type LiveStatus } from '@/lib/live/constants'

const POLL_INTERVAL_MS = 60_000

/**
 * Poll the public live-status endpoint so the nav Live tab can light up while
 * the Facebook Page is broadcasting. Keeps the last known status on transient
 * fetch errors and stops polling on unmount.
 */
export function useLiveStatus(): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>(OFFLINE_LIVE_STATUS)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const res = await fetch('/api/live/status', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as LiveStatus
        if (active) setStatus(data)
      } catch {
        // Keep the previous status on transient errors.
      }
    }

    load()
    const id = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  return status
}
