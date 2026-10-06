'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

const SHARE_STATUS_PARAM = 'shareStatus'

function showStatusToast(status: string): void {
  if (status === 'activated') {
    toast.success('Shield active! +30 min', {
      description: 'Thanks for sharing \u2014 your team is protected.',
    })
    return
  }
  if (status === 'already_consumed') {
    toast.info('Already redeemed', {
      description: 'This share link has already been used.',
    })
    return
  }
  if (status === 'expired') {
    toast.warning('Share link expired', {
      description: 'Share links are valid for 15 minutes. Tap share again.',
    })
    return
  }
  if (status === 'signature_mismatch') {
    toast.error('Invalid share link', {
      description: 'Please use the share button on this page.',
    })
    return
  }
  if (status === 'account_too_new') {
    toast.warning('Accounts must be 24+ hours old', {
      description: 'Come back tomorrow to activate a shield.',
    })
    return
  }
  if (status.startsWith('rate_limit_')) {
    const scope =
      status === 'rate_limit_hour'
        ? 'hourly'
        : status === 'rate_limit_day_user'
          ? 'daily'
          : status === 'rate_limit_day_team'
            ? 'team daily'
            : 'rate'
    toast.warning(`${scope.charAt(0).toUpperCase() + scope.slice(1)} limit reached`, {
      description: 'Try again later \u2014 another supporter can share now.',
    })
    return
  }
  toast.error('Could not activate shield', {
    description: `Status: ${status}`,
  })
}

/**
 * Reads `?shareStatus=...` from the URL on mount, fires the matching sonner
 * toast, then strips the param with `router.replace`. Dedupes per status so
 * React StrictMode double-mount doesn't fire twice.
 */
export function ShareStatusToast() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const firedRef = useRef<string | null>(null)

  useEffect(() => {
    const status = searchParams.get(SHARE_STATUS_PARAM)
    if (!status) return
    if (firedRef.current === status) return
    firedRef.current = status

    showStatusToast(status)

    const next = new URLSearchParams(searchParams.toString())
    next.delete(SHARE_STATUS_PARAM)
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    })
  }, [searchParams, pathname, router])

  return null
}
