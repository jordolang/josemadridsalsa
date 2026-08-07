'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const STORAGE_PREFIX = 'jms-announcement-dismissed:'

/**
 * Dismiss wrapper for a dismissible announcement. The dismissal is keyed by
 * announcement id and kept in localStorage, so editing the message (which
 * keeps the id) stays dismissed while a brand-new announcement reappears.
 */
export function AnnouncementBarClient({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: React.ReactNode
}) {
  // Start hidden so a previously dismissed bar does not flash on hydration.
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(`${STORAGE_PREFIX}${id}`) === '1')
    } catch {
      setDismissed(false)
    }
    setReady(true)
  }, [id])

  if (!ready || dismissed) return null

  return (
    <div role="status" className={`relative ${className ?? ''}`}>
      {children}
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          setDismissed(true)
          try {
            window.localStorage.setItem(`${STORAGE_PREFIX}${id}`, '1')
          } catch {
            // A blocked localStorage just means it reappears next visit.
          }
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-80 transition hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
