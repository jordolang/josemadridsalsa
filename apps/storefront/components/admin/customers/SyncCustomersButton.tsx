'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

/**
 * Rebuilds the customer list from registered users + guest-checkout emails and
 * refreshes order rollups. Safe to run repeatedly (idempotent on the server).
 */
export function SyncCustomersButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/customers/sync', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Sync failed')
      toast.success(
        `Synced — ${data.created} added, ${data.linked} linked, ${data.updated} refreshed`
      )
      router.refresh()
    } catch (error) {
      console.error('Customer sync failed:', error)
      toast.error('Sync failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" onClick={run} disabled={busy}>
      {busy ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 size-4" />
      )}
      Sync from orders &amp; users
    </Button>
  )
}
