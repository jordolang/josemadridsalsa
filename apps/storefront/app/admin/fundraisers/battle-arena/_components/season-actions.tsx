'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { SeasonStatus } from '@prisma/client'

interface SeasonActionsProps {
  seasonId: string
  status: SeasonStatus
  hasTeams: boolean
}

async function postAction(path: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(path, { method: 'POST' })
    if (res.status === 404) {
      return { ok: false, error: 'Backend endpoint not shipped yet.' }
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return {
        ok: false,
        error:
          typeof (data as { error?: unknown }).error === 'string'
            ? (data as { error: string }).error
            : `HTTP ${res.status}`,
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

export function SeasonActions({
  seasonId,
  status,
  hasTeams,
}: SeasonActionsProps) {
  const router = useRouter()
  const [resetOpen, setResetOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [pending, setPending] = useState<null | 'reset' | 'end'>(null)

  const isLocked = status === 'ENDED' || status === 'ARCHIVED'

  async function handleReset(): Promise<void> {
    setPending('reset')
    const result = await postAction(
      `/api/admin/arena/seasons/${seasonId}/reset-hp`,
    )
    setPending(null)
    if (!result.ok) {
      toast.error(result.error ?? 'Reset failed')
      return
    }
    toast.success('HP reset for all teams in this season.')
    setResetOpen(false)
    router.refresh()
  }

  async function handleEnd(): Promise<void> {
    setPending('end')
    const result = await postAction(`/api/admin/arena/seasons/${seasonId}/end`)
    setPending(null)
    if (!result.ok) {
      toast.error(result.error ?? 'End failed')
      return
    }
    toast.success('Season ended. Champion has been crowned.')
    setEndOpen(false)
    router.refresh()
  }

  return (
    <div className="flex gap-2">
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isLocked || !hasTeams}
          >
            Reset HP
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset HP for every team?</DialogTitle>
            <DialogDescription>
              Every ACTIVE team in this season gets <code>hpCurrent</code>{' '}
              restored to its <code>goalAmount</code>. This is destructive —
              any in-progress KO is undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setResetOpen(false)}
              disabled={pending !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={pending !== null}
            >
              {pending === 'reset' ? 'Resetting…' : 'Reset HP'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogTrigger asChild>
          <Button
            variant="destructive"
            size="sm"
            disabled={isLocked || !hasTeams}
          >
            End season
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this season?</DialogTitle>
            <DialogDescription>
              Sets status to ENDED and crowns the team with the highest{' '}
              <code>salesCount</code> as champion. This cannot be undone from
              the UI.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEndOpen(false)}
              disabled={pending !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleEnd}
              disabled={pending !== null}
            >
              {pending === 'end' ? 'Ending…' : 'End & crown champion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
