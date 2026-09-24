'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'

/**
 * Starts the Gmail grant.
 *
 * Fetches the consent URL and then navigates, rather than linking straight at the API
 * route: a configuration problem — no OAuth client set — is reported here instead of
 * bouncing the operator to Google and back with an opaque error.
 */
export function ConnectGmailButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    setBusy(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/inbox/google/connect')
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.url) {
        setError(body?.error ?? 'Could not start the Gmail connection.')
        setBusy(false)
        return
      }

      window.location.href = body.url
    } catch {
      setError('Could not reach the server. Try again.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={connect} disabled={busy} variant={label === 'Reconnect' ? 'outline' : 'default'}>
        {busy ? 'Opening Google…' : label}
      </Button>
      {error && <p className="text-sm text-red-800">{error}</p>}
    </div>
  )
}
