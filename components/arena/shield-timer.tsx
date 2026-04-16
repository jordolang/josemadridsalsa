'use client'

import { useEffect, useState } from 'react'

function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00'
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1000)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Live countdown label rendered next to a shield badge. Stops updating once
 * the shield expires to avoid needless renders.
 */
export function ShieldTimer({ expiresAt }: { expiresAt: Date | string }) {
  const target =
    typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  const [remaining, setRemaining] = useState(() =>
    target.getTime() - Date.now(),
  )

  useEffect(() => {
    const tick = () => setRemaining(target.getTime() - Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  return (
    <span className="ml-1.5 font-mono tabular-nums opacity-90">
      {formatRemaining(remaining)}
    </span>
  )
}
