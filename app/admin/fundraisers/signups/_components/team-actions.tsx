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

export function TeamActions({
  teamId,
  teamName,
}: {
  teamId: string
  teamName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issuedKey, setIssuedKey] = useState<string | null>(null)

  async function handleRotate() {
    setError(null)
    setPending(true)
    try {
      const res = await fetch('/api/admin/fundraiser/rotate-key', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teamId }),
      })
      const data = await res.json()
      if (!res.ok || !data?.apiKey) {
        setError(typeof data?.error === 'string' ? data.error : 'Rotate failed')
        return
      }
      setIssuedKey(data.apiKey as string)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setIssuedKey(null)
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Rotate key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rotate API key — {teamName}</DialogTitle>
          <DialogDescription>
            Invalidates the previous key immediately. Any integration using
            it will start getting 401s until updated. The new key is shown
            once.
          </DialogDescription>
        </DialogHeader>

        {issuedKey ? (
          <div className="space-y-3">
            <p className="text-sm">Copy the new key now:</p>
            <code className="block overflow-x-auto rounded bg-muted p-3 font-mono text-xs">
              {issuedKey}
            </code>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRotate}
                disabled={pending}
              >
                {pending ? 'Rotating…' : 'Rotate & issue new key'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
