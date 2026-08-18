'use client'

import { useEffect, useState } from 'react'
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
import { Progress } from '@/components/ui/progress'
import type { FundraiserContactRow } from './FundraiserContactsTable'

interface SolicitResult {
  requested: number
  attempted: number
  sent: number
  failed: number
  skippedSuppressed: number
  skippedNoEmail: number
  skippedDuplicate: number
  skippedIneligible: number
  errors: { organizationName: string; email: string; error: string }[]
}

/**
 * Must stay at or below `MAX_CONTACTS_PER_REQUEST` in the solicit route. Sends are serial and
 * rate-limited there, so one request's wall time scales with the chunk: 200 contacts is about
 * two minutes, comfortably inside the route's `maxDuration`, while a whole-database selection
 * in a single request would be killed part-way through with no record of who had been mailed.
 */
const SOLICIT_CHUNK = 200

const EMPTY: SolicitResult = {
  requested: 0,
  attempted: 0,
  sent: 0,
  failed: 0,
  skippedSuppressed: 0,
  skippedNoEmail: 0,
  skippedDuplicate: 0,
  skippedIneligible: 0,
  errors: [],
}

function merge(a: SolicitResult, b: SolicitResult): SolicitResult {
  return {
    requested: a.requested + b.requested,
    attempted: a.attempted + b.attempted,
    sent: a.sent + b.sent,
    failed: a.failed + b.failed,
    skippedSuppressed: a.skippedSuppressed + b.skippedSuppressed,
    skippedNoEmail: a.skippedNoEmail + b.skippedNoEmail,
    skippedDuplicate: a.skippedDuplicate + b.skippedDuplicate,
    skippedIneligible: a.skippedIneligible + b.skippedIneligible,
    errors: [...a.errors, ...b.errors],
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Confirmation step for the bulk re-signup invitation.
 *
 * Bulk email cannot be recalled, so the dialog makes the operator look at the real recipient
 * count — resolved by the server, not counted from the rows this page happens to have loaded —
 * and tick an explicit acknowledgement before the send button does anything.
 */
export function SolicitContactsDialog({
  contactIds,
  previewContacts,
  onClose,
  onSent,
}: {
  /** Every selected contact, which may extend far beyond the loaded page. */
  contactIds: string[]
  /** The subset whose rows are loaded, used only to show the operator concrete examples. */
  previewContacts: FundraiserContactRow[]
  onClose: () => void
  onSent: () => void
}) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SolicitResult | null>(null)
  const [preflight, setPreflight] = useState<SolicitResult | null>(null)
  /** Deduplicated, eligible ids returned by the preview — the only ids ever sent. */
  const [recipientIds, setRecipientIds] = useState<string[] | null>(null)
  /** Set when a chunk failed after earlier chunks had already mailed. Terminal. */
  const [partial, setPartial] = useState<string | null>(null)

  /**
   * Resolves the real recipient set before anything is sent.
   *
   * One request for the whole selection, not one per send-chunk: duplicate addresses are
   * collapsed against the entire set here, so a coordinator who runs two organizations cannot
   * receive two invitations by landing in different chunks.
   */
  useEffect(() => {
    // Local to this effect run. A shared ref would be reset to false by the next run before
    // the previous request finished, letting a stale response overwrite the new selection.
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('/api/admin/fundraiser-contacts/solicit/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactIds }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? 'Could not resolve the recipient list')
        if (cancelled) return
        // `ok()` serializes its argument directly — there is no `data` envelope.
        setRecipientIds(body?.recipientIds ?? [])
        setPreflight(body?.counts ?? EMPTY)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not resolve the recipient list')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [contactIds])

  const recipientCount = preflight?.sent ?? null
  const skipped = preflight
    ? preflight.skippedSuppressed +
      preflight.skippedNoEmail +
      preflight.skippedDuplicate +
      preflight.skippedIneligible
    : null

  async function send() {
    if (!recipientIds) return
    setSending(true)
    setError(null)
    setProgress(0)

    const batches = chunk(recipientIds, SOLICIT_CHUNK)
    let total = EMPTY
    try {
      for (const [index, batch] of batches.entries()) {
        const response = await fetch('/api/admin/fundraiser-contacts/solicit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactIds: batch, confirm: true }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? 'Send failed')
        total = merge(total, body?.result ?? EMPTY)
        setProgress(Math.round(((index + 1) / batches.length) * 100))
      }
      setResult(total)
    } catch (err) {
      // Earlier batches are already mailed and cannot be recalled. Going back to an armed
      // confirmation screen would let a retry start from the first batch and mail them again,
      // so this state is terminal: report what went out and close.
      const remaining = recipientIds.length - total.sent
      setPartial(
        `${err instanceof Error ? err.message : 'Send failed'}. ${total.sent.toLocaleString()} invitations were sent before this failed; ${remaining.toLocaleString()} were not. Re-select the contacts that were not invited rather than resending this batch.`,
      )
      setResult(total)
    } finally {
      setSending(false)
    }
  }

  if (result) {
    return (
      <Dialog open onOpenChange={() => onSent()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{partial ? 'Sending stopped part-way' : 'Invitations sent'}</DialogTitle>
            <DialogDescription>Here is what happened to each contact.</DialogDescription>
          </DialogHeader>

          {partial && (
            <p className="text-destructive rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              {partial}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Row label="Sent" value={result.sent} />
            <Row label="Failed" value={result.failed} />
            <Row label="Skipped — inactive or do-not-contact" value={result.skippedIneligible} />
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
          <DialogTitle>
            {recipientCount === null
              ? 'Checking who will receive this…'
              : `Invite ${recipientCount.toLocaleString()} contacts to sign up`}
          </DialogTitle>
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
                {contactIds.length.toLocaleString()} contacts are selected
                {skipped !== null &&
                  `; ${skipped.toLocaleString()} will be skipped as inactive, do-not-contact, unsubscribed, suppressed, duplicate, or address-less`}
                .
              </p>
            </div>
          </div>

          <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-xs">
            {previewContacts.slice(0, 25).map((c) => (
              <p key={c.id} className="truncate">
                <span className="font-medium">{c.organizationName}</span>{' '}
                <span className="text-muted-foreground">{c.email}</span>
              </p>
            ))}
            {contactIds.length > Math.min(previewContacts.length, 25) && (
              <p className="text-muted-foreground mt-1">
                …and{' '}
                {(contactIds.length - Math.min(previewContacts.length, 25)).toLocaleString()} more
                not shown
              </p>
            )}
          </div>

          {sending && <Progress value={progress} aria-label="Sending invitations" />}

          <div className="flex items-start gap-2">
            <Checkbox
              id="acknowledge"
              checked={acknowledged}
              // Until the preflight lands there is no count to acknowledge, and a box ticked
              // against "0 people" would silently stay ticked once the real number arrived.
              disabled={recipientCount === null || sending}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
            />
            <Label htmlFor="acknowledge" className="text-sm leading-snug font-normal">
              {recipientCount === null
                ? 'Working out how many contacts will actually receive this…'
                : `I have reviewed this list and want to email these ${recipientCount.toLocaleString()} people.`}
            </Label>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          <Button onClick={send} disabled={!acknowledged || sending || !recipientIds?.length}>
            {sending
              ? `Sending… ${progress}%`
              : `Send ${(recipientCount ?? 0).toLocaleString()} invitations`}
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
