'use client'

import { useState } from 'react'
import { Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/button'

interface ShareForShieldButtonProps {
  teamId: string
  teamName: string
  className?: string
}

/**
 * Battle-tab affordance: activates (or extends) the shield via the existing
 * `POST /api/fundraiser/arena/share` endpoint.
 *
 * TODO: swap to `POST /api/fundraiser/arena/share/intent` + bounce flow once
 * @tom ships the signed-nonce version (tracked in follow-ups).
 */
export function ShareForShieldButton({
  teamId,
  teamName,
  className,
}: ShareForShieldButtonProps) {
  const [pending, setPending] = useState(false)

  async function handleClick(): Promise<void> {
    if (pending) return
    setPending(true)
    try {
      const res = await fetch('/api/fundraiser/arena/share', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teamId, platform: 'other' }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        activated?: boolean
        extended?: boolean
        error?: string
      }

      if (res.status === 401) {
        toast.error('Sign in to activate your team\u2019s shield.')
        return
      }
      if (res.status === 429) {
        toast.warning(
          data.error ??
            'Another supporter needs to share before you can activate again.',
        )
        return
      }
      if (!res.ok || !data.success) {
        toast.error(data.error ?? 'Could not activate shield. Try again.')
        return
      }
      if (data.activated) {
        toast.success('Shield active! +30 min', {
          description: `${teamName} is now protected.`,
        })
      } else if (data.extended) {
        toast.info('Share recorded \u2014 shield already active.')
      }
    } catch {
      toast.error('Network error. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      size="lg"
      onClick={handleClick}
      disabled={pending}
      className={clsx(
        'h-12 gap-2 rounded-2xl bg-cyan-500 font-bold text-white shadow-md shadow-cyan-500/25 hover:bg-cyan-600',
        className,
      )}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Shield className="h-4 w-4" />
      )}
      Share for shield
    </Button>
  )
}
