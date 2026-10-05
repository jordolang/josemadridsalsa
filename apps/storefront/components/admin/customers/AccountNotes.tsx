'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/** The "add a note" box at the top of a customer's account timeline. */
export function AddAccountNote({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function save() {
    setError(null)
    const response = await fetch(`/api/admin/customers/${customerId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setError(data?.error ?? 'Could not save the note')
      return
    }
    setBody('')
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add a note: a phone call, a promise made, anything the next person should know."
        rows={3}
      />
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending || body.trim().length === 0}>
          {pending ? 'Saving…' : 'Add note'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}

export function DeleteAccountNote({ customerId, noteId }: { customerId: string; noteId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  async function remove() {
    if (!window.confirm('Delete this note?')) return
    const response = await fetch(`/api/admin/customers/${customerId}/notes/${noteId}`, {
      method: 'DELETE',
    })
    if (response.ok) startTransition(() => router.refresh())
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      className="text-xs text-muted-foreground hover:text-destructive hover:underline"
    >
      Delete
    </button>
  )
}
