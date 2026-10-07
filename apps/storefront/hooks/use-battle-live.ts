'use client'

import { useEffect, useState } from 'react'
import type { BattleLiveStatus } from '@/lib/arena-game/links'

const POLL_INTERVAL_MS = 30_000

/**
 * Poll how many players are in the Battle Arena game right now, so the nav's Battle Live dot
 * can blink while anyone is playing. Polling pauses while the tab is hidden and resumes (with
 * an immediate refresh) when it is visible again. Keeps the last count on transient errors.
 */
export function useBattleLive(): BattleLiveStatus {
  const [status, setStatus] = useState<BattleLiveStatus>({ playing: 0 })

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setInterval> | null = null

    const load = async () => {
      try {
        const res = await fetch('/api/arena/live')
        if (!res.ok) return
        const data = (await res.json()) as BattleLiveStatus
        if (active && typeof data.playing === 'number') setStatus({ playing: data.playing })
      } catch {
        // Keep the previous count on transient errors.
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
