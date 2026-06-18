'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useLiveStatus } from '@/hooks/use-live-status'

/** Green blinking circle when live; a dim dot otherwise. */
function LiveDot({ live }: { live: boolean }) {
  if (!live) {
    return <span aria-hidden className="h-2 w-2 rounded-full bg-current opacity-40" />
  }
  return (
    <span aria-hidden className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
    </span>
  )
}

/**
 * Desktop "Live" tab, sits next to Shop in the masthead.
 * - Live:    clickable link to /live with a green blinking circle.
 * - Offline: opens the Facebook page in a new tab (still useful, just not "live").
 */
export function LiveNavLink({ isHome }: { isHome: boolean }) {
  const { isLive, facebookPageUrl } = useLiveStatus()

  const label = (
    <span
      className={cn(
        'flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.22em] transition-colors duration-200',
        isLive
          ? 'text-green-500 group-hover:text-green-400'
          : isHome
          ? 'text-white group-hover:text-[#d9a235]'
          : 'text-foreground group-hover:text-salsa-600',
      )}
    >
      <LiveDot live={isLive} />
      Live
    </span>
  )

  const className = cn('group relative flex items-center py-3', isHome ? 'px-8' : 'px-5')

  if (isLive) {
    return (
      <Link href="/live" className={className} aria-label="We're live now — watch the stream">
        {label}
      </Link>
    )
  }

  return (
    <a
      href={facebookPageUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label="We're not live right now — visit our Facebook page"
    >
      {label}
    </a>
  )
}

/** Mobile-sheet variant of the Live link. */
export function LiveNavMobileLink({ onNavigate }: { onNavigate?: () => void }) {
  const { isLive, facebookPageUrl } = useLiveStatus()

  if (isLive) {
    return (
      <Link
        href="/live"
        onClick={onNavigate}
        className="flex min-h-[44px] items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
      >
        <LiveDot live />
        Watch Live Now
      </Link>
    )
  }

  return (
    <a
      href={facebookPageUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onNavigate}
      className="flex min-h-[44px] items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
    >
      <LiveDot live={false} />
      Live on Facebook
    </a>
  )
}
