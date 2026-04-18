'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Pending = 'idle' | 'approving' | 'rejecting'

export function SignupActions({
  signupId,
  defaultPeriod,
}: {
  signupId: string
  defaultPeriod: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState<Pending>('idle')
  const [error, setError] = useState<string | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [issuedKey, setIssuedKey] = useState<string | null>(null)

  const [teamColor, setTeamColor] = useState('#9B7FFF')
  const [activePeriod, setActivePeriod] = useState(defaultPeriod)
  const [approveNotes, setApproveNotes] = useState('')
  const [rejectNotes, setRejectNotes] = useState('')

  async function handleApprove() {
    setError(null)
    setPending('approving')
    try {
      const res = await fetch('/api/admin/fundraiser/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          signupId,
          teamColor,
          activePeriod,
          reviewNotes: approveNotes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Approve failed')
        return
      }
      if (data.apiKey) setIssuedKey(data.apiKey as string)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setPending('idle')
    }
  }

  async function handleReject() {
    setError(null)
    setPending('rejecting')
    try {
      const res = await fetch('/api/admin/fundraiser/reject', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          signupId,
          reviewNotes: rejectNotes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Reject failed')
        return
      }
      setRejectOpen(false)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setPending('idle')
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Dialog
          open={approveOpen}
          onOpenChange={(v) => {
            setApproveOpen(v)
            if (!v) setIssuedKey(null)
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">Approve</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve signup</DialogTitle>
              <DialogDescription>
                Creates a FundraiserTeam, generates an API key (shown once),
                and marks this signup APPROVED.
              </DialogDescription>
            </DialogHeader>

            {issuedKey ? (
              <div className="space-y-3">
                <p className="text-sm">
                  API key issued. Copy it now — it cannot be retrieved later.
                </p>
                <code className="block overflow-x-auto rounded bg-muted p-3 font-mono text-xs">
                  {issuedKey}
                </code>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIssuedKey(null)
                      setApproveOpen(false)
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`period-${signupId}`}>Active period</Label>
                    <Input
                      id={`period-${signupId}`}
                      value={activePeriod}
                      onChange={(e) => setActivePeriod(e.target.value)}
                      placeholder="YYYY-MM"
                      pattern="\d{4}-\d{2}"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`color-${signupId}`}>Team color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`color-${signupId}`}
                        type="color"
                        value={teamColor}
                        onChange={(e) => setTeamColor(e.target.value)}
                        className="h-10 w-14 shrink-0 p-1"
                      />
                      <Input
                        value={teamColor}
                        onChange={(e) => setTeamColor(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`notes-${signupId}`}>Notes (optional)</Label>
                  <Textarea
                    id={`notes-${signupId}`}
                    value={approveNotes}
                    onChange={(e) => setApproveNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                {error && (
                  <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                    {error}
                  </p>
                )}
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setApproveOpen(false)}
                    disabled={pending !== 'idle'}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={pending !== 'idle'}
                  >
                    {pending === 'approving' ? 'Approving…' : 'Approve & issue key'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              Reject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject signup</DialogTitle>
              <DialogDescription>
                The signup stays in the database with status REJECTED. The
                applicant is not notified automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor={`reject-notes-${signupId}`}>
                  Notes (internal — seen by other admins)
                </Label>
                <Textarea
                  id={`reject-notes-${signupId}`}
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  rows={3}
                />
              </div>
              {error && (
                <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setRejectOpen(false)}
                  disabled={pending !== 'idle'}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={pending !== 'idle'}
                >
                  {pending === 'rejecting' ? 'Rejecting…' : 'Reject signup'}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
