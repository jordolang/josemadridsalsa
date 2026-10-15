'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const INTERVAL_MS = 60_000

/**
 * Re-render the page from the server every minute while the tab is visible, so carrier
 * scans the EasyPost webhook writes appear without the customer reloading.
 */
export function AutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [enabled, router])

  return null
}
