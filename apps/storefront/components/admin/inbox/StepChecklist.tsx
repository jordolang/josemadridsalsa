'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

export interface ChecklistStep {
  id: string
  instruction: string
  isOptional: boolean
  completedAt: string | null
  note: string | null
}

/**
 * The checklist that gates the alert.
 *
 * Every tick is a server round trip rather than optimistic local state: whether the alert
 * is still blocking is decided on the server, and a checkbox that looked ticked while the
 * write failed would be the exact lie this feature exists to prevent.
 */
export function StepChecklist({
  emailId,
  steps,
  canEdit,
}: {
  emailId: string
  steps: ChecklistStep[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  async function toggle(step: ChecklistStep) {
    setError(null)
    setBusyId(step.id)

    try {
      const response = await fetch(`/api/admin/inbox/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: step.id,
          action: step.completedAt ? 'reopen' : 'complete',
          note: notes[step.id]?.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.error ?? 'That did not save. Try again.')
        return
      }

      startTransition(() => router.refresh())
    } catch {
      setError('That did not save. Check your connection and try again.')
    } finally {
      setBusyId(null)
    }
  }

  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing is outstanding on this email.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <ul className="space-y-3">
        {steps.map((step) => {
          const done = Boolean(step.completedAt)
          return (
            <li key={step.id} className="flex items-start gap-3">
              <Checkbox
                checked={done}
                disabled={!canEdit || pending || busyId === step.id}
                onCheckedChange={() => toggle(step)}
                aria-label={step.instruction}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <p className={done ? 'text-sm text-muted-foreground line-through' : 'text-sm'}>
                  {step.instruction}
                  {step.isOptional && (
                    <span className="ml-2 text-xs text-muted-foreground">(optional)</span>
                  )}
                </p>
                {done && step.note && (
                  <p className="text-xs text-muted-foreground">{step.note}</p>
                )}
                {!done && canEdit && (
                  <Input
                    value={notes[step.id] ?? ''}
                    onChange={(event) =>
                      setNotes((current) => ({ ...current, [step.id]: event.target.value }))
                    }
                    placeholder="What did you do? (optional)"
                    className="h-8 max-w-md text-xs"
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          You need the messaging:reply permission to work these off.
        </p>
      )}
    </div>
  )
}

export function ReplyPreview({ body, sent }: { body: string; sent: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
        {open ? 'Hide' : 'Show'} {sent ? 'the reply that was sent' : 'the drafted reply'}
      </Button>
      {open && (
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{body}</pre>
      )}
    </div>
  )
}
