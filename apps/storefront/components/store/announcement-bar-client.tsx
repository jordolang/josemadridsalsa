'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import { matchesPath } from '@/lib/cms/paths'
import type { LiveAnnouncement } from '@/lib/cms/queries'

const STORAGE_PREFIX = 'jms-announcement-dismissed:'

const VARIANT_CLASSES: Record<string, string> = {
  INFO: 'bg-primary text-primary-foreground',
  PROMO: 'bg-amber-500 text-black',
  WARNING: 'bg-destructive text-destructive-foreground',
  SUCCESS: 'bg-emerald-600 text-white',
}

/**
 * Picks the announcement targeted at the current path and renders it.
 *
 * The path comes from `usePathname()` rather than the request headers so the
 * bar can render inside a statically prerendered page — `usePathname()` is
 * known at prerender time and does not opt the route out of static rendering.
 * The list arrives already filtered to live announcements and sorted by
 * priority, so the first path match wins.
 *
 * A dismissal is keyed by announcement id and kept in localStorage, so editing
 * the message (which keeps the id) stays dismissed while a brand-new
 * announcement reappears.
 */
export function AnnouncementBarClient({
  announcements,
}: {
  announcements: LiveAnnouncement[]
}) {
  const pathname = usePathname() ?? '/'
  const announcement =
    announcements.find((a) => matchesPath(a.targetPaths, pathname)) ?? null
  const id = announcement?.id ?? null

  // Start hidden so a previously dismissed bar does not flash on hydration.
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (!id) return
    try {
      setDismissed(window.localStorage.getItem(`${STORAGE_PREFIX}${id}`) === '1')
    } catch {
      setDismissed(false)
    }
    setReady(true)
  }, [id])

  if (!announcement) return null

  const classes = VARIANT_CLASSES[announcement.variant] ?? VARIANT_CLASSES.INFO

  const content = (
    <div className="flex items-center justify-center gap-3 px-4 py-2 text-center text-sm font-medium">
      <span>{announcement.message}</span>
      {announcement.ctaText && announcement.ctaHref && (
        <Link href={announcement.ctaHref} className="underline underline-offset-4">
          {announcement.ctaText}
        </Link>
      )}
    </div>
  )

  if (!announcement.dismissible) {
    return (
      <div role="status" className={`w-full ${classes}`}>
        {content}
      </div>
    )
  }

  if (!ready || dismissed) return null

  return (
    <div role="status" className={`relative w-full ${classes}`}>
      {content}
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          setDismissed(true)
          try {
            window.localStorage.setItem(`${STORAGE_PREFIX}${announcement.id}`, '1')
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
