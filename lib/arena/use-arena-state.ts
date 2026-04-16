'use client'

import { useEffect, useRef, useState } from 'react'
import type { ArenaSnapshot } from './server-state'

type Status = 'idle' | 'loading' | 'ok' | 'error'

export type UseArenaState = {
  snapshot: ArenaSnapshot
  status: Status
  error: string | null
  /** Milliseconds since the last successful fetch. */
  staleness: number
}

/**
 * Client-side polling hook for the arena state endpoint.
 *
 * - Starts polling after the first successful mount with the server-rendered
 *   `initial` snapshot so the UI never flashes empty.
 * - Backs off to `errorIntervalMs` on consecutive failures to avoid
 *   hammering when the API is unhealthy.
 * - Pauses when the tab is hidden to cut noise on backgrounded arenas.
 */
export function useArenaState(
  initial: ArenaSnapshot,
  opts: { intervalMs?: number; errorIntervalMs?: number } = {},
): UseArenaState {
  const intervalMs = opts.intervalMs ?? 3000
  const errorIntervalMs = opts.errorIntervalMs ?? 10_000
  const [snapshot, setSnapshot] = useState<ArenaSnapshot>(initial)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [staleness, setStaleness] = useState(0)
  const lastOkRef = useRef<number>(Date.now())
  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let consecutiveErrors = 0

    async function poll() {
      if (cancelRef.current) return
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(poll, intervalMs)
        return
      }
      setStatus('loading')
      try {
        const res = await fetch(
          `/api/fundraiser/arena/${encodeURIComponent(initial.period)}/state`,
          { cache: 'no-store' },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!data?.success) throw new Error(data?.error ?? 'unknown error')
        if (cancelRef.current) return
        setSnapshot({
          ...data.snapshot,
          takenAt: new Date(data.snapshot.takenAt),
          teams: data.snapshot.teams.map((t: ArenaSnapshot['teams'][number]) => ({
            ...t,
            activeShield: t.activeShield
              ? {
                  ...t.activeShield,
                  activatedAt: new Date(t.activeShield.activatedAt),
                  expiresAt: new Date(t.activeShield.expiresAt),
                }
              : null,
          })),
        })
        setStatus('ok')
        setError(null)
        lastOkRef.current = Date.now()
        consecutiveErrors = 0
        timer = setTimeout(poll, intervalMs)
      } catch (err) {
        if (cancelRef.current) return
        const msg = err instanceof Error ? err.message : 'fetch failed'
        setStatus('error')
        setError(msg)
        consecutiveErrors += 1
        const delay = Math.min(
          errorIntervalMs * Math.max(1, Math.pow(2, consecutiveErrors - 1)),
          60_000,
        )
        timer = setTimeout(poll, delay)
      }
    }

    timer = setTimeout(poll, intervalMs)
    const stalenessTimer = setInterval(() => {
      setStaleness(Date.now() - lastOkRef.current)
    }, 1000)

    return () => {
      cancelRef.current = true
      if (timer) clearTimeout(timer)
      clearInterval(stalenessTimer)
    }
  }, [initial.period, intervalMs, errorIntervalMs])

  return { snapshot, status, error, staleness }
}
