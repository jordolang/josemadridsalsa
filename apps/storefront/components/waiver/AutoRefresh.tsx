'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Re-fetches the server component every `seconds` while the tab is visible. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter()

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, seconds * 1000)
    return () => window.clearInterval(timer)
  }, [router, seconds])

  return null
}
