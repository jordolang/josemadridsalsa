'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

/** Revokes the kiosk card reader's Square connection, after a second press to confirm. */
export function SquareDisconnectButton() {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function disconnect() {
    setBusy(true)
    setError(null)
    const response = await fetch('/api/admin/square/oauth/disconnect', { method: 'POST' }).catch(() => null)
    const body = (await response?.json().catch(() => ({}))) as { error?: string } | undefined
    setBusy(false)
    if (!response?.ok) {
      setError(body?.error ?? 'Could not disconnect Square')
      return
    }
    setConfirming(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? (
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => void disconnect()}>
            {busy ? 'Disconnecting…' : 'Yes, disconnect'}
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
            Keep connected
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
          Disconnect
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
