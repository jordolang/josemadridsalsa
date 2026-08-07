'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** How often the unread count is refreshed. Long enough to be cheap, short enough to matter. */
const POLL_INTERVAL_MS = 60_000

/**
 * Unread notification count in the admin header.
 *
 * The bell animates only when the count *rises* — a standing backlog should not jingle at
 * you forever, but something new arriving should catch the eye. The animation is a
 * one-shot, and it is suppressed entirely for users who have asked for reduced motion.
 */
export function NotificationBell() {
  const pathname = usePathname()
  const [unread, setUnread] = useState(0)
  const [isRinging, setIsRinging] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/notifications', { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json()
      const next = Number(data.unread ?? 0)

      setUnread((previous) => {
        if (next > previous) {
          setIsRinging(true)
          // Matches the animation duration below; clearing it lets a later arrival ring again.
          setTimeout(() => setIsRinging(false), 900)
        }
        return next
      })
    } catch {
      // A failed poll leaves the last known count rather than flashing to zero, which would
      // read as "all clear" when the truth is unknown.
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  // Re-check on navigation, so reading the notifications page updates the badge immediately
  // instead of waiting out the poll.
  useEffect(() => {
    void refresh()
  }, [pathname, refresh])

  const label =
    unread === 0 ? 'Notifications' : `${unread} unread notification${unread === 1 ? '' : 's'}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="relative size-8 rounded-md px-0"
          aria-label={label}
        >
          <Link href="/admin/notifications">
            <Bell
              className={cn(
                'size-4',
                isRinging && 'origin-top motion-safe:animate-bell-ring',
                unread > 0 && 'text-foreground'
              )}
            />

            {unread > 0 && (
              <>
                {/* Steady count. Capped so a large backlog cannot widen the header. */}
                <span
                  className={cn(
                    'absolute -right-0.5 -top-0.5 z-10 flex min-w-4 items-center justify-center',
                    'rounded-full bg-destructive px-1 text-[0.6rem] font-semibold leading-4',
                    'text-destructive-foreground tabular-nums'
                  )}
                >
                  {unread > 99 ? '99+' : unread}
                </span>
                {/* Ping ring, shown only while something new has just arrived. */}
                {isRinging && (
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -top-0.5 size-4 animate-ping rounded-full bg-destructive/60 motion-reduce:hidden"
                  />
                )}
              </>
            )}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
