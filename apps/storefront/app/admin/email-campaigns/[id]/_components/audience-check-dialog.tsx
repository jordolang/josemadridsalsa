'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PackageCheck, Send, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AudienceCheck } from '@/lib/email/audience-check'
import { launchCampaign } from '../../actions'
import { confirmAudienceAction, getAudienceCheckAction } from '../actions'

interface AudienceCheckDialogProps {
  campaignId: string
  /** `launch` confirms and starts sending; `confirm` only records the review (scheduled sends). */
  mode: 'launch' | 'confirm'
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The required look at who a campaign will reach before it sends: the count, a
 * sample of names, and, for order and shipping updates, a filter down to people
 * who actually have an open order.
 */
export function AudienceCheckDialog({ campaignId, mode, open, onOpenChange }: AudienceCheckDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [check, setCheck] = useState<AudienceCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [onlyOpenOrders, setOnlyOpenOrders] = useState(false)
  const [reviewed, setReviewed] = useState(false)

  useEffect(() => {
    if (!open) return
    setCheck(null)
    setError(null)
    setReviewed(false)
    startTransition(async () => {
      const result = await getAudienceCheckAction(campaignId)
      if (result.error || !result.check) {
        setError(result.error ?? 'Failed to load the audience')
        return
      }
      setCheck(result.check)
      setOnlyOpenOrders(result.check.suggestOnlyOpenOrders && result.check.withOpenOrder > 0)
    })
  }, [open, campaignId])

  const finalCount = check ? (onlyOpenOrders ? check.withOpenOrder : check.recipientCount) : 0

  const handleConfirm = () => {
    if (!check) return
    setError(null)
    startTransition(async () => {
      const confirmed = await confirmAudienceAction({
        campaignId,
        expectedRecipients: check.recipientCount,
        onlyOpenOrders,
      })
      if (confirmed.error) {
        setError(confirmed.error)
        return
      }
      if (mode === 'launch') {
        const launched = await launchCampaign(campaignId)
        if (launched.error) {
          setError(launched.error)
          router.refresh()
          return
        }
      }
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Check who this goes to</DialogTitle>
          <DialogDescription>
            Review the audience before {mode === 'launch' ? 'sending' : 'this campaign can send on schedule'}.
          </DialogDescription>
        </DialogHeader>

        {!check && !error && <p className="text-sm text-muted-foreground">Loading audience…</p>}

        {check && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-md border p-4">
              <Users className="h-6 w-6 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {finalCount.toLocaleString()} recipient{finalCount === 1 ? '' : 's'}
                </div>
                {check.listName && (
                  <div className="text-sm text-muted-foreground">List: {check.listName}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <PackageCheck className="h-4 w-4 text-muted-foreground" />
              <span>
                {check.withOpenOrder.toLocaleString()} with an open order ·{' '}
                {check.withoutOpenOrder.toLocaleString()} without one
              </span>
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-foreground">Sample of recipients</div>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border p-2 text-sm">
                {check.sample.map((r) => (
                  <li key={r.email} className="flex justify-between gap-2">
                    <span className="truncate">{r.name || '—'}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">{r.email}</span>
                  </li>
                ))}
                {check.sample.length === 0 && (
                  <li className="text-muted-foreground">No pending recipients</li>
                )}
              </ul>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="only-open-orders"
                checked={onlyOpenOrders}
                disabled={check.withOpenOrder === 0}
                onCheckedChange={(v) => setOnlyOpenOrders(v === true)}
              />
              <Label htmlFor="only-open-orders" className="text-sm font-normal leading-snug">
                Only send to people with an open order
                {check.withoutOpenOrder > 0 && (
                  <span className="block text-muted-foreground">
                    Removes {check.withoutOpenOrder.toLocaleString()} recipient
                    {check.withoutOpenOrder === 1 ? '' : 's'} with no order waiting to ship. Use this
                    for shipping and order updates.
                  </span>
                )}
              </Label>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="audience-reviewed"
                checked={reviewed}
                onCheckedChange={(v) => setReviewed(v === true)}
              />
              <Label htmlFor="audience-reviewed" className="text-sm font-normal leading-snug">
                I checked the count and the names, and this is who should get it.
              </Label>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!check || !reviewed || finalCount === 0 || isPending}>
            <Send className="mr-2 h-4 w-4" />
            {isPending
              ? 'Working…'
              : mode === 'launch'
                ? `Send to ${finalCount.toLocaleString()}`
                : 'Confirm audience'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
