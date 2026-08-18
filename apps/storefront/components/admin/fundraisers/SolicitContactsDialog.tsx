'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { FundraiserContactRow } from './FundraiserContactsTable'

interface SolicitResult {
  attempted: number
  sent: number
  failed: number
  skippedSuppressed: number
  skippedNoEmail: number
  skippedDuplicate: number
  errors: { organizationName: string; email: string; error: string }[]
}

/**
 * Confirmation step for the bulk re-signup invitation.
 *
 * Bulk email cannot be recalled, so the dialog makes the operator look at the real recipient
 * count and tick an explicit acknowledgement before the send button does anything. The
 * preview lists the first several addresses because "247 contacts" is easy to agree to
 * without noticing that the filter was wrong.
 */
export function SolicitContactsDialog({
  contacts,
  onClose,
  onSent,
}: {
  contacts: FundraiserContactRow[]
  onClose: () => void
  onSent: () => void
}) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SolicitResult | null>(null)

  // One coordinator can appear under two organizations; the send path mails each address
  // once, so show the number of people who will actually receive mail.
  const uniqueAddresses = new Set(
    contacts.map((c) => c.email?.toLowerCase()).filter(Boolean) as string[],
  )
  const previously = contacts.filter((c) => c.solicitationCount > 0).length

  async function send() {
    setSending(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/fundraiser-contacts/solicit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactIds: contacts.map((c) => c.id),
          confirm: true,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? 'Send failed')
      setResult(body?.data?.result ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  if (result) {
    return (
      <Dialog open onOpenChange={() => onSent()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invitations sent</DialogTitle>
            <DialogDescription>Here is what happened to each contact.</DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Row label="Sent" value={result.sent} />
            <Row label="Failed" value={result.failed} />
            <Row label="Skipped — unsubscribed or suppressed" value={result.skippedSuppressed} />
            <Row label="Skipped — duplicate address" value={result.skippedDuplicate} />
            <Row label="Skipped — no email" value={result.skippedNoEmail} />
          </dl>

          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-xs">
              {result.errors.map((e) => (
                <p key={`${e.email}-${e.organizationName}`} className="text-destructive">
                  {e.organizationName} ({e.email}): {e.error}
                </p>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button onClick={onSent}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite {uniqueAddresses.size.toLocaleString()} contacts to sign up</DialogTitle>
          <DialogDescription>
            Each one gets a personalized email referencing their past campaigns, with a link to
            start a new fundraiser and a working unsubscribe link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">This sends real email and cannot be undone.</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Addresses that have unsubscribed or been suppressed are skipped automatically.
                {previously > 0 && (
                  <>
                    {' '}
                    <span className="font-medium">
                      {previously.toLocaleString()} of these have been invited before.
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-xs">
            {contacts.slice(0, 25).map((c) => (
              <p key={c.id} className="truncate">
                <span className="font-medium">{c.organizationName}</span>{' '}
                <span className="text-muted-foreground">{c.email}</span>
              </p>
            ))}
            {contacts.length > 25 && (
              <p className="text-muted-foreground mt-1">
                …and {(contacts.length - 25).toLocaleString()} more
              </p>
            )}
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="acknowledge"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
            />
            <Label htmlFor="acknowledge" className="text-sm leading-snug font-normal">
              I have reviewed this list and want to email these {uniqueAddresses.size.toLocaleString()}{' '}
              people.
            </Label>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={!acknowledged || sending || contacts.length === 0}>
            {sending ? 'Sending…' : `Send ${uniqueAddresses.size.toLocaleString()} invitations`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value.toLocaleString()}</dd>
    </>
  )
}
