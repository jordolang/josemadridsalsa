'use client'

import { useEffect, useState } from 'react'
import { OFFLINE_LIVE_STATUS, type LiveStatus } from '@/lib/live/constants'

const POLL_INTERVAL_MS = 60_000

/**
 * Poll the public live-status endpoint so the nav Live tab can light up while
 * the Facebook Page is broadcasting. Polling pauses while the tab is hidden and
 * resumes (with an immediate refresh) when it becomes visible again. The fetch
 * intentionally omits `cache: 'no-store'` so the browser can honor the route's
 * `Cache-Control: max-age=30`. Keeps the last known status on transient errors.
 */
export function useLiveStatus(): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>(OFFLINE_LIVE_STATUS)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setInterval> | null = null

    const load = async () => {
      try {
        const res = await fetch('/api/live/status')
        if (!res.ok) return
        const data = (await res.json()) as LiveStatus
        if (active) setStatus(data)
      } catch {
        // Keep the previous status on transient errors.
      }
    }

    const startPolling = () => {
      if (timer) return
      load()
      timer = setInterval(load, POLL_INTERVAL_MS)
    }

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') startPolling()
      else stopPolling()
    }

    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      active = false
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return status
}
